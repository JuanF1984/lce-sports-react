import { useState, useEffect, useRef, useMemo } from 'react'
import ReactQuill, { Quill } from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import supabase from '../../../../utils/supabase'
import { validateEmail } from '../../../../lib/email/validateEmail'
import { apiAdminFetch } from '../../../../lib/apiAdminFetch'

// Registrar el attributor de tamaño con inline styles en lugar de clases CSS
// para que los tamaños funcionen en clientes de email
const SizeStyle = Quill.import('attributors/style/size')
SizeStyle.whitelist = ['12px', '16px', '20px', '28px']
Quill.register(SizeStyle, true)
import { useEvents } from '../../../../hooks/useEvents'
import { formatearFecha } from '../../../../utils/dateUtils'

const prepararCuerpoEmail = (html) =>
    html
        .replace(/<p><br><\/p>/g, '<div style="height:0.9em;">&nbsp;</div>')
        .replace(/<p>([\s\S]*?)<\/p>/g, '<div style="margin:0;padding-bottom:0.6em;line-height:1.7;">$1</div>')

const QUILL_MODULES = {
    toolbar: [
        [{ size: ['12px', '16px', '20px', '28px'] }],
        ['bold', 'italic'],
        [{ color: [] }],
        ['clean'],
    ],
}
const QUILL_FORMATS = ['size', 'bold', 'italic', 'color']

const DELAY_ENTRE_BATCHES_MS = 600
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STORAGE_BUCKET = 'email-images'

const EmailMasivo = () => {
    const { eventsData, eventsLoading } = useEvents()

    // Filtros de destinatarios (mutuamente excluyentes)
    const [eventoId, setEventoId] = useState('')
    const [localidadFiltro, setLocalidadFiltro] = useState('')
    const [todosContactos, setTodosContactos] = useState(false)
    const [inscriptos, setInscriptos] = useState([])
    const [loadingInscriptos, setLoadingInscriptos] = useState(false)
    const [juegosFiltro, setJuegosFiltro] = useState(null) // null = todos, Set = selección específica
    const [excludedCount, setExcludedCount] = useState(0)
    const [newlyInvalidList, setNewlyInvalidList] = useState([])

    const juegosDisponibles = useMemo(() => {
        const map = new Map()
        inscriptos.forEach(i => {
            ;(i.juegos || []).forEach(j => {
                if (j?.id && !map.has(j.id)) map.set(j.id, j.game_name)
            })
        })
        return [...map.entries()]
            .map(([id, game_name]) => ({ id, game_name }))
            .sort((a, b) => a.game_name.localeCompare(b.game_name, 'es'))
    }, [inscriptos])

    const inscriptosFiltrados = useMemo(() => {
        if (juegosFiltro === null) return inscriptos
        if (juegosFiltro.size === 0) return []
        return inscriptos.filter(i =>
            (i.juegos || []).some(j => j?.id && juegosFiltro.has(j.id))
        )
    }, [inscriptos, juegosFiltro])

    // Localidades únicas ordenadas alfabéticamente
    const localidades = eventsData
        ? [...new Set(eventsData.map(e => e.localidad).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, 'es'))
        : []

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

    // Lista combinada (usa inscriptos filtrados por juego)
    const todosDestinatarios = [
        ...inscriptosFiltrados.map(i => ({ ...i, origen: 'evento' })),
        ...manuales,
    ]

    // ── Cargar inscriptos según el filtro activo ──
    useEffect(() => {
        if (!eventoId && !localidadFiltro && !todosContactos) {
            setInscriptos([])
            return
        }

        const fetchInscriptos = async () => {
            setLoadingInscriptos(true)
            setExcludedCount(0)
            setNewlyInvalidList([])
            try {
                let allData = []

                if (todosContactos) {
                    // Paginación por cursor — puede haber miles de registros
                    const BATCH = 1000
                    let cursor = null
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        let q = supabase
                            .from('inscriptions')
                            .select('nombre, apellido, email, created_at, id')
                            .order('created_at', { ascending: true })
                            .order('id', { ascending: true })
                            .limit(BATCH)
                        if (cursor) {
                            q = q.or(
                                `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
                            )
                        }
                        const { data, error } = await q
                        if (error) throw error
                        if (!data || data.length === 0) break
                        allData = allData.concat(data)
                        if (data.length < BATCH) break
                        cursor = { created_at: data[data.length - 1].created_at, id: data[data.length - 1].id }
                    }
                } else {
                    let query = supabase.from('inscriptions')
                        .select('nombre, apellido, email, games_inscriptions(game:games(id, game_name))')
                    if (eventoId) {
                        query = query.eq('id_evento', eventoId)
                    } else {
                        const eventIds = (eventsData || [])
                            .filter(e => e.localidad === localidadFiltro)
                            .map(e => e.id)
                        if (eventIds.length === 0) {
                            setInscriptos([])
                            return
                        }
                        query = query.in('id_evento', eventIds)
                    }
                    const { data, error } = await query
                    if (error) throw error
                    allData = data || []
                }

                // Obtener blacklist de emails inválidos
                const { data: invalidData } = await supabase
                    .from('invalid_emails')
                    .select('email')
                const invalidSet = new Set((invalidData || []).map(r => r.email.toLowerCase()))

                const emailsManuales = new Set(manuales.map(m => m.email.toLowerCase().trim()))
                const emailMap = new Map()
                allData.forEach(i => {
                    const key = i.email?.toLowerCase().trim()
                    if (!key || emailsManuales.has(key)) return
                    const juegos = (i.games_inscriptions || []).map(gi => gi.game).filter(Boolean)
                    if (emailMap.has(key)) {
                        const ex = emailMap.get(key)
                        juegos.forEach(j => {
                            if (!ex.juegos.some(ej => ej.id === j.id)) ex.juegos.push(j)
                        })
                    } else {
                        emailMap.set(key, { nombre: i.nombre, apellido: i.apellido, email: i.email, juegos })
                    }
                })

                // Filtrar emails inválidos (blacklisted + formato inválido)
                const nuevosInvalidos = []
                const unicos = []
                let excluidos = 0

                for (const [key, entry] of emailMap) {
                    if (invalidSet.has(key)) {
                        excluidos++
                        continue
                    }
                    const result = validateEmail(key)
                    if (!result.valid) {
                        nuevosInvalidos.push({ email: key, reason: result.reason })
                        excluidos++
                        continue
                    }
                    unicos.push(entry)
                }

                // Guardar nuevos inválidos detectados por formato
                if (nuevosInvalidos.length > 0) {
                    try {
                        await apiAdminFetch('/api/admin/invalid-emails', {
                            method: 'POST',
                            body: JSON.stringify({
                                emails: nuevosInvalidos.map(e => ({
                                    email: e.email,
                                    reason: e.reason,
                                    detected_by: 'validation',
                                })),
                            }),
                        })
                    } catch (err) {
                        console.error('Error al guardar emails inválidos:', err)
                    }
                }

                setExcludedCount(excluidos)
                setNewlyInvalidList(nuevosInvalidos)
                setInscriptos(unicos)
                setSeleccionados(new Set([
                    ...unicos.map(i => i.email),
                    ...manuales.map(m => m.email),
                ]))
            } catch (err) {
                console.error('Error al cargar inscriptos:', err)
            } finally {
                setLoadingInscriptos(false)
            }
        }

        fetchInscriptos()
    }, [eventoId, localidadFiltro, todosContactos])

    // Actualizar seleccionados cuando cambia el filtro de juego
    useEffect(() => {
        if (!eventoId && !localidadFiltro) return
        setSeleccionados(new Set([
            ...inscriptosFiltrados.map(i => i.email),
            ...manuales.map(m => m.email),
        ]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [juegosFiltro])

    // Advertir si el usuario intenta cerrar la pestaña durante un envío activo
    useEffect(() => {
        if (!enviando) return
        const handler = (e) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [enviando])

    // ── Filtro por juego ──
    const toggleTodosJuegos = () => setJuegosFiltro(prev => prev === null ? new Set() : null)

    const toggleJuego = (id) => {
        setJuegosFiltro(prev => {
            if (prev === null) return new Set([id])
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

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

        const recipients = destinatarios.map(d => ({
            email: d.email,
            name: `${d.nombre} ${d.apellido}`.trim(),
        }))

        const chunks = []
        for (let i = 0; i < recipients.length; i += 100) {
            chunks.push(recipients.slice(i, i + 100))
        }

        const messageBody = prepararCuerpoEmail(cuerpo)
        const imageHtml = imagenSrcFinal
            ? `<img src="${imagenSrcFinal}" alt="Imagen" style="max-width:100%;border-radius:8px;display:block;margin:0 auto;box-shadow:0 4px 15px rgba(0,0,0,0.4);" />`
            : ''

        setEnviando(true)
        setResultados([])
        setProgreso({ current: 0, total: chunks.length, sent: 0, failed: 0 })

        let totalSent = 0
        const allFailed = []

        for (let i = 0; i < chunks.length; i++) {
            let result
            try {
                const r = await apiAdminFetch('/api/admin/email/send-batch', {
                    method: 'POST',
                    body: JSON.stringify({
                        recipients: chunks[i],
                        subject: asunto,
                        messageBody,
                        imageHtml,
                    }),
                })
                result = await r.json()
            } catch (err) {
                result = {
                    sent: 0,
                    failed: chunks[i].map(r => ({ email: r.email, error: err?.message || 'Error de red' })),
                }
            }

            totalSent += result.sent || 0
            allFailed.push(...(result.failed || []))

            setProgreso({
                current: i + 1,
                total: chunks.length,
                sent: totalSent,
                failed: allFailed.length,
            })

            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_BATCHES_MS))
            }
        }

        setResultados(allFailed)

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

                {/* ── Todos los contactos ── */}
                <label className="email-masivo-todos-contactos">
                    <input
                        type="checkbox"
                        checked={todosContactos}
                        disabled={enviando}
                        onChange={e => {
                            setTodosContactos(e.target.checked)
                            if (e.target.checked) {
                                setEventoId('')
                                setLocalidadFiltro('')
                            }
                            setJuegosFiltro(null)
                            setProgreso(null)
                            setResultados([])
                        }}
                    />
                    <span className="email-masivo-todos-titulo">Todos los contactos de la base</span>
                    <span className="email-masivo-todos-desc">Emails únicos de todos los eventos</span>
                </label>

                <div className="email-masivo-filtros-sep">— o filtrar por —</div>

                <div className="filter-group">
                    <label className="filter-label">Filtrar por evento:</label>
                    {eventsLoading ? (
                        <p style={{ color: '#ecf0f1' }}>Cargando eventos...</p>
                    ) : (
                        <select
                            className="filter-select"
                            value={eventoId}
                            disabled={enviando}
                            onChange={e => {
                                setEventoId(e.target.value)
                                setLocalidadFiltro('')
                                setTodosContactos(false)
                                setJuegosFiltro(null)
                                setProgreso(null)
                                setResultados([])
                            }}
                        >
                            <option value="">-- Sin filtro de evento --</option>
                            {eventsData?.slice().sort((a, b) => a.localidad.localeCompare(b.localidad, 'es')).map(ev => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.localidad} — {formatearFecha(ev.fecha_inicio)}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="filter-group">
                    <label className="filter-label">Filtrar por localidad (todos los eventos de esa ciudad):</label>
                    {eventsLoading ? (
                        <p style={{ color: '#ecf0f1' }}>Cargando...</p>
                    ) : (
                        <select
                            className="filter-select"
                            value={localidadFiltro}
                            disabled={enviando}
                            onChange={e => {
                                setLocalidadFiltro(e.target.value)
                                setEventoId('')
                                setTodosContactos(false)
                                setJuegosFiltro(null)
                                setProgreso(null)
                                setResultados([])
                            }}
                        >
                            <option value="">-- Sin filtro de localidad --</option>
                            {localidades.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    )}
                </div>

                {juegosDisponibles.length > 0 && (
                    <div className="filter-group">
                        <label className="filter-label">Filtrar por juego:</label>
                        <div className="email-masivo-juegos-filtro">
                            <label className="email-masivo-juego-check">
                                <input
                                    type="checkbox"
                                    checked={juegosFiltro === null}
                                    onChange={toggleTodosJuegos}
                                />
                                <span>Todos los juegos ({inscriptos.length})</span>
                            </label>
                            {juegosDisponibles.map(j => {
                                const count = inscriptos.filter(i =>
                                    (i.juegos || []).some(jg => jg.id === j.id)
                                ).length
                                return (
                                    <label key={j.id} className="email-masivo-juego-check">
                                        <input
                                            type="checkbox"
                                            checked={juegosFiltro === null || juegosFiltro.has(j.id)}
                                            onChange={() => toggleJuego(j.id)}
                                        />
                                        <span>{j.game_name} ({count})</span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                )}

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

            {/* ── Resumen de destinatarios válidos/excluidos ── */}
            {!loadingInscriptos && (eventoId || localidadFiltro || todosContactos) && (
                <div style={{ margin: '12px 0' }}>
                    {inscriptosFiltrados.length > 0 && (
                        <p style={{ color: '#1abc9c', margin: '0 0 4px' }}>
                            Se enviarán a <strong>{seleccionados.size}</strong> destinatario{seleccionados.size !== 1 ? 's' : ''}
                        </p>
                    )}
                    {excludedCount > 0 && (
                        <p style={{ color: '#f39c12', margin: '0 0 4px' }}>
                            {excludedCount} email{excludedCount !== 1 ? 's' : ''} excluido{excludedCount !== 1 ? 's' : ''} por estar marcado{excludedCount !== 1 ? 's' : ''} como inválido{excludedCount !== 1 ? 's' : ''}
                        </p>
                    )}
                    {newlyInvalidList.length > 0 && (
                        <details style={{ marginTop: 8, background: '#2c1a1a', border: '1px solid #e74c3c', borderRadius: 6, padding: '8px 12px' }}>
                            <summary style={{ color: '#e74c3c', cursor: 'pointer', fontWeight: 600 }}>
                                {newlyInvalidList.length} email{newlyInvalidList.length !== 1 ? 's' : ''} inválido{newlyInvalidList.length !== 1 ? 's' : ''} nuevo{newlyInvalidList.length !== 1 ? 's' : ''} detectado{newlyInvalidList.length !== 1 ? 's' : ''} y marcado{newlyInvalidList.length !== 1 ? 's' : ''} automáticamente
                            </summary>
                            <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', color: '#ecf0f1', fontSize: '0.85rem' }}>
                                {newlyInvalidList.map(e => (
                                    <li key={e.email}><strong>{e.email}</strong> — {e.reason}</li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}

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
                                {(manuales.length > 0 || inscriptosFiltrados.length > 0) && inscriptos.length > 0 && (
                                    <span style={{ color: '#95a5a6', fontSize: '0.85rem', marginLeft: 8 }}>
                                        ({inscriptosFiltrados.length}
                                        {juegosFiltro !== null && juegosFiltro.size > 0
                                            ? ` de ${juegosDisponibles.filter(j => juegosFiltro.has(j.id)).map(j => j.game_name).join(', ')}`
                                            : localidadFiltro ? ` de ${localidadFiltro}` : ' del evento'
                                        }
                                        {manuales.length > 0 ? ` · ${manuales.length} manuales` : ''})
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
                                {enviando
                                    ? `Enviando batch ${progreso.current} de ${progreso.total}...`
                                    : 'Envío finalizado'}
                            </h3>

                            <div className="email-masivo-barra-wrapper">
                                <div
                                    className="email-masivo-barra-fill"
                                    style={{ width: `${progreso.total > 0 ? Math.round((progreso.current / progreso.total) * 100) : 0}%` }}
                                />
                            </div>
                            <p style={{ color: '#ecf0f1', textAlign: 'center', margin: '6px 0 16px' }}>
                                {progreso.sent} enviados
                                {progreso.failed > 0 && (
                                    <span style={{ color: '#e74c3c', marginLeft: 8 }}>· {progreso.failed} fallidos</span>
                                )}
                            </p>

                            {!enviando && resultados.length > 0 && (() => {
                                const invalidados = resultados.filter(r =>
                                    r.error && (/non-ascii/i.test(r.error) || /invalid.*email/i.test(r.error) || /no permitidos/i.test(r.error))
                                )
                                return (
                                    <>
                                        {invalidados.length > 0 && (
                                            <div style={{ background: '#2c1a1a', border: '1px solid #e74c3c', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                                                <p style={{ color: '#e74c3c', margin: '0 0 4px', fontWeight: 600 }}>
                                                    {invalidados.length} email{invalidados.length !== 1 ? 's' : ''} rechazado{invalidados.length !== 1 ? 's' : ''} por Resend y marcado{invalidados.length !== 1 ? 's' : ''} como inválido{invalidados.length !== 1 ? 's' : ''}:
                                                </p>
                                                <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#ecf0f1', fontSize: '0.85rem' }}>
                                                    {invalidados.map((r, i) => (
                                                        <li key={i}><strong>{r.email}</strong></li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <details style={{ marginBottom: 16 }}>
                                            <summary style={{ color: '#e74c3c', cursor: 'pointer', marginBottom: 8 }}>
                                                {resultados.length} email{resultados.length !== 1 ? 's' : ''} con error — ver detalle
                                            </summary>
                                            <div className="email-masivo-log">
                                                {resultados.map((r, idx) => (
                                                    <div key={idx} className="email-masivo-log-item error">
                                                        <span>✗</span>
                                                        <span>{r.email}</span>
                                                        <span className="email-masivo-log-error">{r.error}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    </>
                                )
                            })()}

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
