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
        question: "¿En que modo se juega?",
        answer: "Primero se juega en br para sacar puntos x partidas. Luegos se eligen los 4 mejores y se hace duelo de escuadras para sacar el 3er, 2do y 1er lugar."
      },
      {
        question: "¿Hay que usar cuenta personal?",
        answer: "Sí, tienen que usar su propia cuenta y su dispositivo móvil."
      },
      {
        question: "¿Cuántas rondas son?",
        answer: "En br son 4 partidas cada uno y en duelo de escuadra es al mejor de tres."
      },
      {
        question: "¿Cuáles son las reglas?",
        answer: "En el modo br está todo permitido, tanto granadas como cualquier habilidad, y en el modo de duelo de escuadra no se permiten granadas."
      },
      {
        question: "¿Las balas son infinitas?",
        answer: "En el modo de br las balas no son infinitas, las balas solamente son infinitas en el modo de duelo de escuadra."
      }
    ]
  },
  valorant: {
    title: "Valorant",
    faqs: [
      {
        question: "¿Necesito traer periféricos para Valorant?",
        answer: "Contamos con perifericos, pero podes traer los tuyos (teclado, mouse, auriculares)."
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
        question: "¿Es necesario contar con una cuenta Steam?",
        answer: "Sí, es necesario contar con cuentar Steam."
      },
      {
        question: "¿Cómo es el baneo?",
        answer: "Habrá baneo de mapas en el modo competitivo."
      }
    ]
  },
  formula1: {
    "title": "Fórmula 1",
    "faqs": [
      {
        "question": "¿Cómo son las competencias? ¿Individuales o grupales?",
        "answer": "Las competencias son individuales y con modalidad contra reloj."
      },
      {
        "question": "¿Qué pista se usa en la competencia?",
        "answer": "Se utiliza siempre la pista de España."
      },
      {
        "question": "¿Cuántas vueltas hay que dar?",
        "answer": "Se corren 3 vueltas en la pista y se toma el mejor tiempo de una de ellas."
      },
      {
        "question": "¿Qué tipo de transmisión se usa en las primeras etapas?",
        "answer": "Hasta los octavos de final (inclusive) se usa transmisión Automática y controles activados (modo aficionado)."
      },
      {
        "question": "¿Puedo elegir el tipo de transmisión en las etapas avanzadas?",
        "answer": "Sí, a partir de cuartos de final, cada competidor puede elegir el tipo de transmisión que prefiera."
      }
    ]
  },
  // lol: {
  //   title: "League of Legends",
  //   faqs: [
  //     {
  //       question: "¿Cuál es el formato del torneo de LOL?",
  //       answer: "El torneo será 5vs5 en Grieta del Invocador, formato de eliminación doble."
  //     },
  //     {
  //       question: "¿Puedo usar mi propia cuenta de LOL?",
  //       answer: "Sí, se juega con cuentas personales."
  //     },
  //     {
  //       question: "¿Cuántos equipos pueden participar en LOL?",
  //       answer: "El máximo de equipos para LOL es de 16."
  //     }
  //   ]
  // },
  fifa: {
    "title": "FIFA",
    "faqs": [
      {
        "question": "¿Qué versión de FIFA se jugará?",
        "answer": "Se jugará EA FC 25."
      },
      {
        "question": "¿El torneo es individual o por equipos?",
        "answer": "Se juegan ambas versiones: individual y por equipo (2v2). Primero se juega el torneo individual para luego jugar el 2v2."
      },
      {
        "question": "¿Se puede elegir cualquier equipo?",
        "answer": "Sí, se pueden elegir equipos o selecciones nacionales, pero no equipos personalizados."
      },
      {
        "question": "¿Con qué consolas contamos para jugar?",
        "answer": "Contamos con dos PlayStation 5 y una PlayStation 4."
      },
      {
        "question": "¿Puedo llevar mi propio joystick?",
        "answer": "Sí, podés traer tu propio joystick para jugar."
      },
      {
        "question": "¿Cómo es el formato del torneo?",
        "answer": "El torneo cuenta con una ronda clasificatoria y una de repechaje hasta tener 32 equipos para hacer eliminación directa. Los partidos tanto para clasificar como repechaje son totalmente al azar, para luego sortear los 16avos de final."
      },
      {
        "question": "¿Cuál es la duración de los partidos?",
        "answer": "Los partidos duran 3 minutos por tiempo."
      },
      {
        "question": "¿Qué pasa si hay empate?",
        "answer": "No hay empates, tiene que haber un ganador sí o sí. Se juega tiempo suplementario y en caso de persistir el empate se define en tanda de penales."
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