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

        // Inside src/components/ResolveRouter.jsx - Look for your switch statement:

        switch (type) {
            case 'application':
                navigate(`/tenant/applications?highlight=${id}`);
                break;

            case 'maintenance':
                // 🔴 FORCE IT TO LOAD THE EXACT RECT PATH WITH THE TICKET QUERY ATTACHED:
                navigate(`/tenant/maintenance?ticket=${id}`);
                break;

            default:
                // If it hits this fallback, it means type or id was missing
                navigate('/tenant/dashboard');
        }

    }, [searchParams, navigate]);

    return (
        <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
            <h3>🤖 AI Intelligent Router</h3>
            <p>Redirecting you to the requested property dashboard view...</p>
        </div>
    );
}
