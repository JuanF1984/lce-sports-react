import { useState } from 'react';
import '@styles/FAQ.css';

export const FAQ = () => {
    // Lista de preguntas y respuestas
    const faqs = [
        { question: '¿Cómo puedo registrarme?', answer: 'Haz clic en "Registrarse" en la parte superior.' },
        { question: '¿Puedo participar si no tengo PC?', answer: 'Sí, las computadoras las llevamos nosotros' },
        { question: '¿Puedo participar sin equipo?', answer: 'Sí, en inscripciones tenes la opción de participación individual o por equipo' },
        { question: '¿Cómo puedo contactarlos?', answer: 'Envía un correo a lcsports00@gmail.com.' },
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
