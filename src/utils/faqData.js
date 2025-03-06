// src/utils/faqData.js

export const faqData = {
    general: {
      title: "Preguntas Generales",
      faqs: [
        { 
          question: "¿Cómo puedo registrarme?", 
          answer: "Haz clic en \"Registrarse\" en la parte superior." 
        },
        { 
          question: "¿Puedo participar si no tengo PC?", 
          answer: "Sí, las computadoras las llevamos nosotros" 
        },
        { 
          question: "¿Puedo participar sin equipo?", 
          answer: "Sí, en inscripciones tenes la opción de participación individual o por equipo" 
        },
        { 
          question: "¿Cómo puedo contactarlos?", 
          answer: "Envía un correo a lcsports00@gmail.com." 
        }
      ]
    },
    freeFire: {
      title: "Free Fire",
      faqs: [
        { 
          question: "¿Cuál es el formato del torneo de Free Fire?", 
          answer: "El torneo será en formato Battle Royale con equipos de 4 jugadores." 
        },
        { 
          question: "¿Qué dispositivos se utilizarán para Free Fire?", 
          answer: "Se juega en smartphones proporcionados por la organización." 
        },
        { 
          question: "¿Se puede usar mi propia cuenta de Free Fire?", 
          answer: "Sí, puedes usar tu cuenta personal durante el torneo." 
        }
      ]
    },
    valorant: {
      title: "Valorant",
      faqs: [
        { 
          question: "¿Cuál es el formato del torneo de Valorant?", 
          answer: "Eliminación directa, mejor de tres mapas (Bo3)." 
        },
        { 
          question: "¿Necesito traer periféricos para Valorant?", 
          answer: "Recomendamos traer tus propios periféricos (teclado, mouse, auriculares), pero tendremos disponibles si no puedes." 
        },
        { 
          question: "¿Qué mapas se jugarán en Valorant?", 
          answer: "Se jugarán todos los mapas del pool competitivo actual, con sistema de veto." 
        }
      ]
    },
    counterStrike: {
      title: "Counter Strike",
      faqs: [
        { 
          question: "¿Qué versión de Counter Strike se jugará?", 
          answer: "Se jugará Counter Strike 2." 
        },
        { 
          question: "¿Cuál es el formato del torneo de CS?", 
          answer: "Grupos + eliminación directa, partidas al mejor de tres mapas (Bo3)." 
        },
        { 
          question: "¿Habrá premios para Counter Strike?", 
          answer: "Sí, habrá premios en efectivo y productos de patrocinadores para los tres primeros lugares." 
        }
      ]
    },
    formula1: {
      title: "Fórmula 1",
      faqs: [
        { 
          question: "¿Qué versión del juego de F1 se utilizará?", 
          answer: "Se utilizará F1 2023 de EA Sports." 
        },
        { 
          question: "¿Hay configuraciones personalizadas para F1?", 
          answer: "Se permitirán ajustes de asistencia según el nivel del jugador, pero las condiciones de carrera serán iguales para todos." 
        },
        { 
          question: "¿Se juega con volante o control?", 
          answer: "Tendremos disponibles ambas opciones, volantes y controles de consola." 
        }
      ]
    },
    lol: {
      title: "League of Legends",
      faqs: [
        { 
          question: "¿Cuál es el formato del torneo de LOL?", 
          answer: "El torneo será 5vs5 en Grieta del Invocador, formato de eliminación doble." 
        },
        { 
          question: "¿Puedo usar mi propia cuenta de LOL?", 
          answer: "Sí, se juega con cuentas personales." 
        },
        { 
          question: "¿Cuántos equipos pueden participar en LOL?", 
          answer: "El máximo de equipos para LOL es de 16." 
        }
      ]
    },
    fifa: {
      title: "FIFA",
      faqs: [
        { 
          question: "¿Qué versión de FIFA se jugará?", 
          answer: "Se jugará EA FC 24 (anteriormente conocido como FIFA)." 
        },
        { 
          question: "¿El torneo es individual o por equipos?", 
          answer: "El torneo de FIFA es exclusivamente individual." 
        },
        { 
          question: "¿Se puede elegir cualquier equipo?", 
          answer: "Sí, se pueden elegir equipos o selecciones nacionales, pero no equipos personalizados." 
        }
      ]
    }
  };
  
  // Función para obtener todas las FAQs
  export const getAllFAQs = () => {
    let allFaqs = [];
    
    Object.keys(faqData).forEach(category => {
      allFaqs = [...allFaqs, ...faqData[category].faqs];
    });
    
    return allFaqs;
  };
  
  // Función para obtener FAQs por categoría
  export const getFAQsByCategory = (categoryKey) => {
    return faqData[categoryKey]?.faqs || [];
  };
  
  // Función para obtener todas las categorías
  export const getAllCategories = () => {
    return Object.keys(faqData).map(key => ({
      key,
      title: faqData[key].title
    }));
  };