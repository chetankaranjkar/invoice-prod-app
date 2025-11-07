import React from 'react';
import { LoginForm } from '../components/LoginForm';

interface LoginPageProps {
    onLoginSuccess: () => void;
}

// Make sure this is a function component, not a variable
export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    return <LoginForm onLoginSuccess={onLoginSuccess} />;
};