import { useState, useEffect, useMemo } from 'react'

const DETECTED_BY_LABELS = {
    validation: 'Validación automática',
    resend_error: 'Error de Resend',
    manual: 'Manual',
}

const EmailsInvalidos = () => {
    const [emails, setEmails] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filtroTipo, setFiltroTipo] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(null) // email a confirmar
    const [deleting, setDeleting] = useState(null)
    const [inscriptionsModal, setInscriptionsModal] = useState(null) // { email, data }
    const [loadingInsc, setLoadingInsc] = useState(false)

    const fetchEmails = async () => {
        setLoading(true)
        setError('')
        try {
            const r = await fetch('/api/admin/invalid-emails')
            const json = await r.json()
            if (!r.ok) throw new Error(json.error || 'Error al cargar')
            setEmails(json.invalidEmails || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchEmails() }, [])

    const filtered = useMemo(() => {
        return emails.filter(e => {
            if (filtroTipo && e.detected_by !== filtroTipo) return false
            if (busqueda && !e.email.includes(busqueda.toLowerCase()) && !e.reason.toLowerCase().includes(busqueda.toLowerCase())) return false
            return true
        })
    }, [emails, filtroTipo, busqueda])

    const handleDelete = async (email) => {
        setDeleting(email)
        try {
            const r = await fetch(`/api/admin/invalid-emails/${encodeURIComponent(email)}`, { method: 'DELETE' })
            if (!r.ok) {
                const json = await r.json()
                throw new Error(json.error || 'Error al eliminar')
            }
            setEmails(prev => prev.filter(e => e.email !== email))
            setConfirmDelete(null)
        } catch (err) {
            alert(`Error: ${err.message}`)
        } finally {
            setDeleting(null)
        }
    }

    const handleVerInscripciones = async (email) => {
        setLoadingInsc(true)
        setInscriptionsModal({ email, data: null })
        try {
            const r = await fetch(`/api/admin/invalid-emails/${encodeURIComponent(email)}`)
            const json = await r.json()
            if (!r.ok) throw new Error(json.error || 'Error')
            setInscriptionsModal({ email, data: json.inscriptions || [] })
        } catch (err) {
            setInscriptionsModal({ email, data: [], error: err.message })
        } finally {
            setLoadingInsc(false)
        }
    }

    const formatDate = (iso) => {
        if (!iso) return '—'
        const d = new Date(iso)
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="inscriptions-container">
            <h2 className="titulos-admin">Emails Inválidos</h2>
            <p style={{ color: '#95a5a6', marginBottom: 16 }}>
                Lista de emails que no pueden recibir envíos masivos. Se marcan automáticamente cuando fallan validaciones o son rechazados por Resend.
            </p>

            {/* Filtros */}
            <div className="filters-container" style={{ maxWidth: '100%', marginBottom: 16 }}>
                <div className="filter-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 0 }}>
                    <select
                        className="filter-select"
                        style={{ flex: '0 0 220px' }}
                        value={filtroTipo}
                        onChange={e => setFiltroTipo(e.target.value)}
                    >
                        <option value="">Todos los tipos</option>
                        <option value="validation">Validación automática</option>
                        <option value="resend_error">Error de Resend</option>
                        <option value="manual">Manual</option>
                    </select>
                    <input
                        type="text"
                        className="filter-select"
                        style={{ flex: 1, minWidth: 200 }}
                        placeholder="Buscar por email o motivo..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                    <button className="export-button" style={{ margin: 0 }} onClick={fetchEmails}>
                        Actualizar
                    </button>
                </div>
            </div>

            {loading && <p style={{ color: '#ecf0f1', textAlign: 'center' }}>Cargando...</p>}
            {error && <p style={{ color: '#e74c3c', textAlign: 'center' }}>{error}</p>}

            {!loading && !error && (
                <>
                    <p style={{ color: '#95a5a6', fontSize: '0.9rem', marginBottom: 8 }}>
                        {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                        {filtroTipo || busqueda ? ` (de ${emails.length} total)` : ''}
                    </p>
                    <div className="email-masivo-tabla-wrapper">
                        <table className="inscriptions-table">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Motivo</th>
                                    <th>Detectado</th>
                                    <th>Origen</th>
                                    <th style={{ width: 180 }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', color: '#95a5a6' }}>
                                            No hay registros
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(e => (
                                        <tr key={e.email}>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{e.email}</td>
                                            <td style={{ fontSize: '0.85rem', color: '#bdc3c7', maxWidth: 300 }}>{e.reason}</td>
                                            <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(e.detected_at)}</td>
                                            <td>
                                                <span style={{
                                                    fontSize: '0.78rem',
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                    background: e.detected_by === 'resend_error' ? '#4a1a1a' : e.detected_by === 'manual' ? '#1a3a4a' : '#1a3a1a',
                                                    color: e.detected_by === 'resend_error' ? '#e74c3c' : e.detected_by === 'manual' ? '#3498db' : '#2ecc71',
                                                }}>
                                                    {DETECTED_BY_LABELS[e.detected_by] || e.detected_by}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <button
                                                        className="export-button"
                                                        style={{ margin: 0, padding: '4px 10px', fontSize: '0.82rem' }}
                                                        onClick={() => handleVerInscripciones(e.email)}
                                                    >
                                                        Ver inscripciones
                                                    </button>
                                                    <button
                                                        className="cancel-button"
                                                        style={{ margin: 0, padding: '4px 10px', fontSize: '0.82rem' }}
                                                        onClick={() => setConfirmDelete(e.email)}
                                                        disabled={deleting === e.email}
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Modal confirmación de eliminación */}
            {confirmDelete && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }}>
                    <div style={{
                        background: '#1e2a3a', borderRadius: 10, padding: 28, maxWidth: 420, width: '90%',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid #2c3e50',
                    }}>
                        <h3 style={{ color: '#ecf0f1', marginTop: 0 }}>Quitar de la lista</h3>
                        <p style={{ color: '#bdc3c7' }}>
                            ¿Quitás <strong style={{ color: '#ecf0f1' }}>{confirmDelete}</strong> de la lista de emails inválidos?
                            Podrá volver a recibir emails masivos.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button
                                className="export-button"
                                style={{ margin: 0 }}
                                onClick={() => setConfirmDelete(null)}
                                disabled={!!deleting}
                            >
                                Cancelar
                            </button>
                            <button
                                className="cancel-button"
                                style={{ margin: 0 }}
                                onClick={() => handleDelete(confirmDelete)}
                                disabled={!!deleting}
                            >
                                {deleting ? 'Quitando...' : 'Sí, quitar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal inscripciones */}
            {inscriptionsModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }}>
                    <div style={{
                        background: '#1e2a3a', borderRadius: 10, padding: 28, maxWidth: 600, width: '90%',
                        maxHeight: '80vh', overflowY: 'auto',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid #2c3e50',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ color: '#ecf0f1', margin: 0 }}>
                                Inscripciones de {inscriptionsModal.email}
                            </h3>
                            <button
                                className="email-masivo-btn-eliminar"
                                onClick={() => setInscriptionsModal(null)}
                            >✕</button>
                        </div>

                        {loadingInsc && <p style={{ color: '#ecf0f1' }}>Cargando...</p>}
                        {inscriptionsModal.error && (
                            <p style={{ color: '#e74c3c' }}>{inscriptionsModal.error}</p>
                        )}
                        {inscriptionsModal.data && inscriptionsModal.data.length === 0 && (
                            <p style={{ color: '#95a5a6' }}>No se encontraron inscripciones para este email.</p>
                        )}
                        {inscriptionsModal.data && inscriptionsModal.data.length > 0 && (
                            <table className="inscriptions-table">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Juego principal</th>
                                        <th>Juego secundario</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inscriptionsModal.data.map(i => (
                                        <tr key={i.id}>
                                            <td>{i.nombre} {i.apellido}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{i.principal_game || '—'}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{i.secondary_game || '—'}</td>
                                            <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                                {i.created_at ? new Date(i.created_at).toLocaleDateString('es-AR') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default EmailsInvalidos
