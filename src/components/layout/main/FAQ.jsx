import { useState } from 'react';
import '@styles/FAQ.css';
import { faqData } from '../../../utils/faqData';

export const FAQ = () => {
    // Estado para controlar qué categoría está seleccionada
    const [activeCategory, setActiveCategory] = useState('general');

    // Estado para controlar qué pregunta está abierta
    const [openIndex, setOpenIndex] = useState(null);

    // Alternar pregunta abierta
    const toggleFAQ = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    // Obtener todas las categorías
    const categories = Object.keys(faqData);

    return (
        <section className='faq'>
            <h2>Preguntas Frecuentes</h2>

            {/* Navegación de categorías */}
            <div className="faq-categories">
                {categories.map(categoryKey => (
                    <button
                        key={categoryKey}
                        className={`category-button ${activeCategory === categoryKey ? 'active' : ''}`}
                        onClick={() => {
                            setActiveCategory(categoryKey);
                            setOpenIndex(null); // Cerrar preguntas abiertas al cambiar de categoría
                        }}
                    >
                        {faqData[categoryKey].title}
                    </button>
                ))}
            </div>

            {/* Título de la categoría activa */}
            <h3 className="category-title">{faqData[activeCategory].title}</h3>

            {/* Lista de preguntas de la categoría seleccionada */}
            <ul className="faq-list">
                {faqData[activeCategory].faqs.map((faq, index) => (
                    <li key={index} className="faq-item">
                        <button
                            className={`faq-question ${openIndex === index ? 'active' : ''}`}
                            onClick={() => toggleFAQ(index)}
                        >
                            {faq.question}
                            <span className="faq-icon">{openIndex === index ? '−' : '+'}</span>
                        </button>
                        {openIndex === index && (
                            <div className="faq-answer">
                                <p dangerouslySetInnerHTML={{ __html: faq.answer }}></p>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
};
