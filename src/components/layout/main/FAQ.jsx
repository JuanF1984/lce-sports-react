import { useState } from 'react';
import '@styles/FAQ.css';

export const FAQ = () => {
// Lista de preguntas y respuestas
const faqs = [
    { question: '¿Cómo puedo registrarme?', answer: 'Haz clic en "Registrarse" en la parte superior.' },
    { question: '¿Olvidé mi contraseña, qué hago?', answer: 'Usa el enlace "Olvidé mi contraseña" en el inicio de sesión.' },
    { question: '¿Cómo contacto soporte?', answer: 'Envía un correo a soporte@ejemplo.com.' },
];

// Estado para controlar qué pregunta está abierta
const [openIndex, setOpenIndex] = useState(null);

// Alternar pregunta abierta
const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
};

    return (
        <section className='faq'>
            <h2>Preguntas Frecuentes</h2>
            <ul className="faq-list">
                {faqs.map((faq, index) => (
                    <li key={index} className="faq-item">
                        <button className="faq-question" onClick={() => toggleFAQ(index)}>
                            {faq.question}
                        </button>
                        {openIndex === index && (
                            <p className="faq-answer">{faq.answer}</p>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    )
}
