import '../../../styles/Footer.css'

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <p>
                &copy; {currentYear} LC E-Sports. Todos los derechos reservados.
            </p>
        </footer>
    )
}
