import { createContext, useContext, useState } from 'react';

const BackHandlerContext = createContext({ backHandler: null, setBackHandler: () => {} });

export const BackHandlerProvider = ({ children }) => {
    const [backHandler, setBackHandler] = useState(null);
    return (
        <BackHandlerContext.Provider value={{ backHandler, setBackHandler }}>
            {children}
        </BackHandlerContext.Provider>
    );
};

export const useBackHandler = () => useContext(BackHandlerContext);
