// Configuración local de juegos: slug para imágenes y color para placeholders.
// Las imágenes van en public/assets/img/games/{slug}-card.jpg y {slug}-banner.jpg
export const GAME_CONFIG = {
    // League of Legends
    'LoL':                { slug: 'lol',      color: '#C8AA6E', requiresVerify: true,  verifyType: 'riot'  },
    'League of Legends':  { slug: 'lol',      color: '#C8AA6E', requiresVerify: true,  verifyType: 'riot'  },
    // Counter-Strike / CS2
    'CS2':                { slug: 'cs2',      color: '#DE9B35', requiresVerify: true,  verifyType: 'steam' },
    'Counter-Strike 2':   { slug: 'cs2',      color: '#DE9B35', requiresVerify: true,  verifyType: 'steam' },
    'Counter Strike':     { slug: 'cs2',      color: '#DE9B35', requiresVerify: true,  verifyType: 'steam' },
    'Counter Strike 2':   { slug: 'cs2',      color: '#DE9B35', requiresVerify: true,  verifyType: 'steam' },
    // FIFA / EA FC
    'FIFA':               { slug: 'fifa',     color: '#1A3C34', requiresVerify: false, verifyType: null    },
    'EA FC':              { slug: 'fifa',     color: '#1A3C34', requiresVerify: false, verifyType: null    },
    // Valorant
    'Valorant':           { slug: 'valorant', color: '#FF4655', requiresVerify: true,  verifyType: 'riot'  },
    // Free Fire
    'Free Fire':          { slug: 'ff',       color: '#FF6600', requiresVerify: false, verifyType: null    },
    'FF':                 { slug: 'ff',       color: '#FF6600', requiresVerify: false, verifyType: null    },
    // Clash Royale
    'Clash Royale':       { slug: 'cr',       color: '#2A7CDE', requiresVerify: false, verifyType: null    },
    'CR':                 { slug: 'cr',       color: '#2A7CDE', requiresVerify: false, verifyType: null    },
    // F1
    'F1':                 { slug: 'f1',       color: '#E10600', requiresVerify: false, verifyType: null    },
    'Fórmula 1':          { slug: 'f1',       color: '#E10600', requiresVerify: false, verifyType: null    },
    'Formula 1':          { slug: 'f1',       color: '#E10600', requiresVerify: false, verifyType: null    },
};

export const getGameConfig = (gameName) =>
    GAME_CONFIG[gameName] ?? { slug: gameName.toLowerCase().replace(/\s+/g, '-'), color: '#3b6cb4', requiresVerify: false, verifyType: null };
