import logo from '@img/logo.webp' 
import '@styles/LogoNeon.css'

export const LogoNeon = () => {
    return (
        <div id="loadingScreen" className="loading-screen">
            <div className="logo-container">
                <img src={logo} alt="Logo de LC E-Sport" className="logo"/>
                <div className="neon-border"></div>
            </div>
        </div>
    )
}
