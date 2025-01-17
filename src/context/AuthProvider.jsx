import { createContext, useContext, useState, useEffect } from "react";
import supabase from "../utils/supabase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                setUser(session?.user || null);
                setIsLoading(false);
                
            } catch (err) {
                console.error("Error checking auth status:", err.message);
                setIsLoading(false);
            }
        };

        const { subscription } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user || null);

           
        });

        checkSession();

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;