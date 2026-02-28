import { useState, useEffect, useRef } from 'react'
import ReactQuill, { Quill } from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import supabase from '../../../../utils/supabase'

// Registrar el attributor de tamaño con inline styles en lugar de clases CSS
// para que los tamaños funcionen en clientes de email
const SizeStyle = Quill.import('attributors/style/size')
SizeStyle.whitelist = ['12px', '16px', '20px', '28px']
Quill.register(SizeStyle, true)
import { useEvents } from '../../../../hooks/useEvents'
import { enviarEmailMasivo } from '../../../../utils/emailMasivoService'
import { formatearFecha } from '../../../../utils/dateUtils'

const QUILL_MODULES = {
    toolbar: [
        [{ size: ['12px', '16px', '20px', '28px'] }],
        ['bold', 'italic'],
        [{ color: [] }],
        ['clean'],
    ],
}
const QUILL_FORMATS = ['size', 'bold', 'italic', 'color']

const DELAY_ENTRE_ENVIOS_MS = 500
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STORAGE_BUCKET = 'email-images'

const EmailMasivo = () => {
    const { eventsData, eventsLoading } = useEvents()

    // Evento (opcional)
    const [eventoId, setEventoId] = useState('')
    const [inscriptos, setInscriptos] = useState([])
    const [loadingInscriptos, setLoadingInscriptos] = useState(false)

    // Contactos manuales
    const [manuales, setManuales] = useState([])
    const [inputManual, setInputManual] = useState({ nombre: '', apellido: '', email: '' })
    const [errorManual, setErrorManual] = useState('')

    // Selección
    const [seleccionados, setSeleccionados] = useState(new Set())

    // Mensaje
    const [asunto, setAsunto] = useState('')
    const [cuerpo, setCuerpo] = useState('')

    // Imagen
    const [imagenPreview, setImagenPreview] = useState('')   // base64 local para preview
    const [imagenSrcFinal, setImagenSrcFinal] = useState('') // URL pública para el email
    const [uploadedPath, setUploadedPath] = useState('')     // path en Supabase para eliminar
    const [uploadingImage, setUploadingImage] = useState(false)
    const [imagenUrl, setImagenUrl] = useState('')           // URL manual
    const [errorImagen, setErrorImagen] = useState('')
    const fileInputRef = useRef(null)

    // Envío
    const [enviando, setEnviando] = useState(false)
    const [progreso, setProgreso] = useState(null)
    const [resultados, setResultados] = useState([])

    // Lista combinada
    const todosDestinatarios = [
        ...inscriptos.map(i => ({ ...i, origen: 'evento' })),
        ...manuales,
    ]

    // ── Cargar inscriptos al seleccionar evento ──
    useEffect(() => {
        if (!eventoId) {
            setInscriptos([])
            return
        }

        const fetchInscriptos = async () => {
            setLoadingInscriptos(true)
            try {
                const { data, error } = await supabase
                    .from('inscriptions')
                    .select('nombre, apellido, email')
                    .eq('id_evento', eventoId)

                if (error) throw error

                const emailsManuales = new Set(manuales.map(m => m.email.toLowerCase().trim()))
                const vistos = new Set()
                const unicos = data.filter(i => {
                    const key = i.email?.toLowerCase().trim()
                    if (!key || vistos.has(key) || emailsManuales.has(key)) return false
                    vistos.add(key)
                    return true
                })

                setInscriptos(unicos)
                setSeleccionados(prev => {
                    const next = new Set(prev)
                    unicos.forEach(i => next.add(i.email))
                    return next
                })
            } catch (err) {
                console.error('Error al cargar inscriptos:', err)
            } finally {
                setLoadingInscriptos(false)
            }
        }

        fetchInscriptos()
    }, [eventoId])

    // ── Contactos manuales ──
    const agregarManual = () => {
        const emailTrim = inputManual.email.trim()

        if (!emailTrim) { setErrorManual('El email es obligatorio.'); return }
        if (!EMAIL_REGEX.test(emailTrim)) { setErrorManual('Formato de email inválido.'); return }
        if (todosDestinatarios.some(d => d.email.toLowerCase() === emailTrim.toLowerCase())) {
            setErrorManual('Ese email ya está en la lista.')
            return
        }

        const nuevo = {
            id: Date.now(),
            nombre: inputManual.nombre.trim() || '—',
            apellido: inputManual.apellido.trim() || '',
            email: emailTrim,
            origen: 'manual',
        }

        setManuales(prev => [...prev, nuevo])
        setSeleccionados(prev => new Set([...prev, nuevo.email]))
        setInputManual({ nombre: '', apellido: '', email: '' })
        setErrorManual('')
    }

    const eliminarManual = (email) => {
        setManuales(prev => prev.filter(m => m.email !== email))
        setSeleccionados(prev => { const next = new Set(prev); next.delete(email); return next })
    }

    // ── Imagen — subir a Supabase Storage ──
    const handleArchivoImagen = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setErrorImagen('')

        // Preview local inmediato con FileReader (sin esperar el upload)
        const reader = new FileReader()
        reader.onload = (ev) => setImagenPreview(ev.target.result)
        reader.readAsDataURL(file)

        // Subir a Supabase
        setUploadingImage(true)
        try {
            const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
            const path = `temp/${Date.now()}-${safeName}`

            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(path, file, { upsert: true })

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)

            setImagenSrcFinal(data.publicUrl)
            setUploadedPath(path)
            setImagenUrl('')
        } catch (err) {
            console.error('Error al subir imagen:', err)
            const msg = err?.message || err?.error_description || JSON.stringify(err)
            setErrorImagen(`Error al subir: ${msg}`)
            setImagenPreview('')
        } finally {
            setUploadingImage(false)
        }
    }

    // Eliminar imagen de Supabase Storage
    const eliminarDeStorage = async (path) => {
        if (!path) return
        try {
            await supabase.storage.from(STORAGE_BUCKET).remove([path])
        } catch (err) {
            console.error('Error al eliminar imagen temporal:', err)
        }
    }

    const handleUrlImagen = (e) => {
        const url = e.target.value
        setImagenUrl(url)
        setImagenPreview(url)
        setImagenSrcFinal(url)
        setErrorImagen('')
        // Si había una imagen subida a Supabase, la eliminamos
        if (uploadedPath) {
            eliminarDeStorage(uploadedPath)
            setUploadedPath('')
        }
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const limpiarImagen = () => {
        if (uploadedPath) eliminarDeStorage(uploadedPath)
        setImagenPreview('')
        setImagenSrcFinal('')
        setUploadedPath('')
        setImagenUrl('')
        setErrorImagen('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // ── Checkboxes ──
    const toggleSeleccionado = (email) => {
        setSeleccionados(prev => {
            const next = new Set(prev)
            if (next.has(email)) next.delete(email)
            else next.add(email)
            return next
        })
    }

    const toggleTodos = () => {
        if (seleccionados.size === todosDestinatarios.length) {
            setSeleccionados(new Set())
        } else {
            setSeleccionados(new Set(todosDestinatarios.map(d => d.email)))
        }
    }

    const todosSeleccionados = todosDestinatarios.length > 0 && seleccionados.size === todosDestinatarios.length
    const algunoSeleccionado = seleccionados.size > 0
    const hayDestinatarios = todosDestinatarios.length > 0

    // ── Envío ──
    const handleEnviar = async () => {
        const destinatarios = todosDestinatarios.filter(d => seleccionados.has(d.email))
        if (destinatarios.length === 0) return

        setEnviando(true)
        setResultados([])
        setProgreso({ total: destinatarios.length, enviados: 0 })

        for (let i = 0; i < destinatarios.length; i++) {
            const dest = destinatarios[i]
            try {
                await enviarEmailMasivo(dest, asunto, cuerpo, imagenSrcFinal)
                setResultados(prev => [...prev, {
                    email: dest.email,
                    nombre: `${dest.nombre} ${dest.apellido}`.trim(),
                    ok: true
                }])
            } catch (err) {
                setResultados(prev => [...prev, {
                    email: dest.email,
                    nombre: `${dest.nombre} ${dest.apellido}`.trim(),
                    ok: false,
                    error: err?.text || err?.message || 'Error desconocido'
                }])
            }
            setProgreso({ total: destinatarios.length, enviados: i + 1 })

            if (i < destinatarios.length - 1) {
                await new Promise(res => setTimeout(res, DELAY_ENTRE_ENVIOS_MS))
            }
        }

        // Eliminar imagen temporal de Supabase una vez terminado el envío
        if (uploadedPath) {
            await eliminarDeStorage(uploadedPath)
            setUploadedPath('')
        }

        setEnviando(false)
    }

    const resetear = () => {
        setProgreso(null)
        setResultados([])
        setAsunto('')
        setCuerpo('')
        limpiarImagen()
    }

    // Quill genera '<p><br></p>' cuando está vacío — strip tags para validar
    const cuerpoTextoPlano = cuerpo.replace(/<[^>]*>/g, '').trim()
    const puedeEnviar = !enviando && !uploadingImage && algunoSeleccionado && asunto.trim() && cuerpoTextoPlano

    // ──────────────────────────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────────────────────────
    return (
        <div className="inscriptions-container">
            <h2 className="titulos-admin">Email Masivo</h2>

            {/* ── Panel de destinatarios ── */}
            <div className="filters-container" style={{ maxWidth: '100%' }}>

                <div className="filter-group">
                    <label className="filter-label">Evento (opcional — carga inscriptos automáticamente):</label>
                    {eventsLoading ? (
                        <p style={{ color: '#ecf0f1' }}>Cargando eventos...</p>
                    ) : (
                        <select
                            className="filter-select"
                            value={eventoId}
                            onChange={e => {
                                setEventoId(e.target.value)
                                setProgreso(null)
                                setResultados([])
                            }}
                        >
                            <option value="">-- Sin filtro de evento --</option>
                            {eventsData?.map(ev => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.localidad} — {formatearFecha(ev.fecha_inicio)}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="filter-group" style={{ marginBottom: 0 }}>
                    <label className="filter-label">Agregar destinatario manualmente:</label>
                    <div className="email-masivo-manual-form">
                        <input
                            type="text"
                            className="filter-select"
                            placeholder="Nombre"
                            value={inputManual.nombre}
                            onChange={e => setInputManual(prev => ({ ...prev, nombre: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && agregarManual()}
                        />
                        <input
                            type="text"
                            className="filter-select"
                            placeholder="Apellido"
                            value={inputManual.apellido}
                            onChange={e => setInputManual(prev => ({ ...prev, apellido: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && agregarManual()}
                        />
                        <input
                            type="email"
                            className="filter-select"
                            placeholder="email@ejemplo.com *"
                            value={inputManual.email}
                            onChange={e => { setInputManual(prev => ({ ...prev, email: e.target.value })); setErrorManual('') }}
                            onKeyDown={e => e.key === 'Enter' && agregarManual()}
                            style={{ flex: 2 }}
                        />
                        <button className="export-button" onClick={agregarManual} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                            + Agregar
                        </button>
                    </div>
                    {errorManual && <p className="email-masivo-error-manual">{errorManual}</p>}
                </div>
            </div>

            {/* ── Tabla de destinatarios ── */}
            {loadingInscriptos ? (
                <p style={{ color: '#ecf0f1', textAlign: 'center' }}>Cargando inscriptos...</p>
            ) : hayDestinatarios ? (
                <>
                    <div className="email-masivo-destinatarios">
                        <div className="email-masivo-destinatarios-header">
                            <span style={{ color: '#ecf0f1' }}>
                                Destinatarios —{' '}
                                <strong style={{ color: '#1abc9c' }}>{seleccionados.size}</strong>{' '}
                                de {todosDestinatarios.length} seleccionados
                                {manuales.length > 0 && inscriptos.length > 0 && (
                                    <span style={{ color: '#95a5a6', fontSize: '0.85rem', marginLeft: 8 }}>
                                        ({inscriptos.length} del evento · {manuales.length} manuales)
                                    </span>
                                )}
                            </span>
                            <button
                                className="export-button"
                                style={{ margin: 0, padding: '6px 14px', fontSize: '0.9rem' }}
                                onClick={toggleTodos}
                            >
                                {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                            </button>
                        </div>

                        <div className="email-masivo-tabla-wrapper">
                            <table className="inscriptions-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>
                                            <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos} title="Seleccionar todos" />
                                        </th>
                                        <th>Nombre</th>
                                        <th>Apellido</th>
                                        <th>Email</th>
                                        <th style={{ width: 60 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todosDestinatarios.map(d => (
                                        <tr key={d.email} onClick={() => toggleSeleccionado(d.email)} style={{ cursor: 'pointer' }}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={seleccionados.has(d.email)}
                                                    onChange={() => toggleSeleccionado(d.email)}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </td>
                                            <td>{d.nombre}</td>
                                            <td>{d.apellido}</td>
                                            <td>
                                                {d.email}
                                                {d.origen === 'manual' && (
                                                    <span className="email-masivo-badge-manual">Manual</span>
                                                )}
                                            </td>
                                            <td>
                                                {d.origen === 'manual' && (
                                                    <button
                                                        className="email-masivo-btn-eliminar"
                                                        title="Eliminar"
                                                        onClick={e => { e.stopPropagation(); eliminarManual(d.email) }}
                                                    >✕</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Editor del mensaje ── */}
                    {!progreso && (
                        <div className="email-masivo-editor">
                            <h3 className="email-masivo-section-title">Redactar mensaje</h3>

                            <div className="filter-group">
                                <label className="filter-label">Asunto:</label>
                                <input
                                    type="text"
                                    className="filter-select"
                                    placeholder="Ej: Información importante sobre el evento"
                                    value={asunto}
                                    onChange={e => setAsunto(e.target.value)}
                                />
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">Mensaje:</label>
                                <div className="email-masivo-quill-wrapper">
                                    <ReactQuill
                                        theme="snow"
                                        value={cuerpo}
                                        onChange={setCuerpo}
                                        modules={QUILL_MODULES}
                                        formats={QUILL_FORMATS}
                                        placeholder="Escribí el cuerpo del mensaje aquí..."
                                    />
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">Imagen opcional:</label>
                                <div className="email-masivo-imagen-opciones">
                                    <div className="email-masivo-imagen-opcion">
                                        <span className="email-masivo-imagen-label">Subir archivo</span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="email-masivo-file-input"
                                            onChange={handleArchivoImagen}
                                            disabled={uploadingImage}
                                        />
                                        {uploadingImage && (
                                            <span style={{ color: '#1abc9c', fontSize: '0.85rem' }}>
                                                Subiendo imagen...
                                            </span>
                                        )}
                                    </div>
                                    <div className="email-masivo-imagen-separador">ó</div>
                                    <div className="email-masivo-imagen-opcion" style={{ flex: 1 }}>
                                        <span className="email-masivo-imagen-label">URL pública</span>
                                        <input
                                            type="url"
                                            className="filter-select"
                                            placeholder="https://ejemplo.com/imagen.jpg"
                                            value={imagenUrl}
                                            onChange={handleUrlImagen}
                                            disabled={!!uploadedPath}
                                        />
                                    </div>
                                </div>

                                {errorImagen && <p className="email-masivo-error-manual">{errorImagen}</p>}

                                {imagenPreview && !uploadingImage && (
                                    <div className="email-masivo-imagen-preview">
                                        <img src={imagenPreview} alt="Preview" />
                                        {uploadedPath && (
                                            <span style={{ color: '#1abc9c', fontSize: '0.8rem', marginTop: 4 }}>
                                                ✓ Subida a Supabase — se eliminará automáticamente tras el envío
                                            </span>
                                        )}
                                        <button
                                            className="cancel-button"
                                            style={{ margin: '8px auto 0', padding: '6px 14px', fontSize: '0.85rem' }}
                                            onClick={limpiarImagen}
                                        >
                                            Quitar imagen
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                className="export-button"
                                onClick={handleEnviar}
                                disabled={!puedeEnviar}
                                style={{ opacity: puedeEnviar ? 1 : 0.5, cursor: puedeEnviar ? 'pointer' : 'not-allowed' }}
                            >
                                {uploadingImage ? 'Esperando imagen...' : `Enviar a ${seleccionados.size} destinatario${seleccionados.size !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    )}

                    {/* ── Panel de progreso ── */}
                    {progreso && (
                        <div className="email-masivo-progreso">
                            <h3 className="email-masivo-section-title">
                                {enviando ? 'Enviando...' : 'Envío finalizado'}
                            </h3>

                            <div className="email-masivo-barra-wrapper">
                                <div
                                    className="email-masivo-barra-fill"
                                    style={{ width: `${Math.round((progreso.enviados / progreso.total) * 100)}%` }}
                                />
                            </div>
                            <p style={{ color: '#ecf0f1', textAlign: 'center', margin: '6px 0 16px' }}>
                                {progreso.enviados} / {progreso.total} enviados
                            </p>

                            <div className="email-masivo-log">
                                {resultados.map((r, idx) => (
                                    <div key={idx} className={`email-masivo-log-item ${r.ok ? 'ok' : 'error'}`}>
                                        <span>{r.ok ? '✓' : '✗'}</span>
                                        <span>{r.nombre} — {r.email}</span>
                                        {!r.ok && <span className="email-masivo-log-error">{r.error}</span>}
                                    </div>
                                ))}
                            </div>

                            {!enviando && (
                                <button className="export-button" onClick={resetear} style={{ marginTop: 16 }}>
                                    Nuevo envío
                                </button>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <p style={{ color: '#95a5a6', textAlign: 'center', marginTop: 24 }}>
                    Seleccioná un evento o agregá destinatarios manualmente para comenzar.
                </p>
            )}
        </div>
    )
}

export default EmailMasivo
