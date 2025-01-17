import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import '../../styles/WhatsAppButton.css'

const WhatsAppButton = () => {
  const whatsappLink = "https://wa.me/message/WNKWNX2EKUZZO1?fbclid=PAZXh0bgNhZW0CMTEAAaZi37SDpUKEBiNo6usbFZnGDVwPg3pBkX_j_ABOLKhyOiikgXwB31YVOSI_aem_xrNGXLQPfUGLfKrvOo7eXA"; // Reemplaza con tu número.

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-button"
    >
      <FontAwesomeIcon icon={faWhatsapp} />
    </a>
  );
};

export default WhatsAppButton;
