// src/components/ResolveRouter.jsx
import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ResolveRouter() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const type = searchParams.get('type');
        const id = searchParams.get('id');

        if (!type || !id) {
            navigate('/dashboard');
            return;
        }

        switch (type) {
            case 'application':
                navigate(`/dashboard/applications?highlight=${id}`);
                break;
            case 'maintenance':
                navigate(`/dashboard/maintenance?ticket=${id}`);
                break;
            default:
                navigate('/dashboard');
        }
    }, [searchParams, navigate]);

    return (
        <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
            <h3>🤖 AI Intelligent Router</h3>
            <p>Redirecting you to the requested property dashboard view...</p>
        </div>
    );
}
