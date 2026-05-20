import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { customFetch } from '../api/http';
import Header from '../components/Header';
import Footer from '../components/Footer';

export interface TemplateCard {
    id: number;
    title: string;
    description?: string;
    width: number;
    height: number;
    thumbnailUrl?: string;
    isTemplate: boolean;
    updatedAt: string;
    ownerId: number | null;
}

export default function Templates() {
    const navigate = useNavigate();
    const [usingLocal, setUsingLocal] = useState(false);

    const { data: templates, isLoading, isError } = useQuery<TemplateCard[]>({
        queryKey: ['templates'],
        queryFn: async () => {
            try {
                const response = await customFetch('/api/project/templates');
                if (!response.ok) throw new Error('Failed to fetch templates');
                const json = await response.json();
                if (Array.isArray(json) && json.length > 0) {
                    setUsingLocal(false);
                    return json;
                }
                // fallback to local file when empty
                throw new Error('Empty templates from API');
            } catch {
                try {
                    const fallback = await fetch('/templates.json');
                    if (!fallback.ok) return [];
                    const local = await fallback.json();
                    setUsingLocal(true);
                    return local;
                } catch {
                    return [];
                }
            }
        },
    });

    const createFromTemplateMutation = useMutation({
        mutationFn: async (templateId: number) => {
            const formData = new FormData();
            formData.append('title', 'New Project from Template');
            formData.append('sourceTemplateId', templateId.toString());

            const response = await customFetch('/api/project/create', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Failed to create project from template');
            return response.json();
        },
        onSuccess: (newProject) => {
            navigate(`/editor/${newProject.id}`);
        },
        onError: (err) => {
            console.error('Project creation failed:', err);
            alert('Failed to create a project from template. Please try again.');
        }
    });

    return (
        <div className="app">
            <Header />
            <main className="home-page">
                <div className="home-container">
                    <header className="home-header">
                        <div className="header-content">
                            <h1>Template Gallery</h1>
                            <p className="subtitle">Choose a starting point for your next design</p>
                        </div>
                    </header>

                    {usingLocal && (
                        <div style={{ padding: '8px 12px', background: '#fff7ed', color: '#92400e', borderRadius: 6, marginBottom: 12, textAlign: 'center' }}>
                            Using local system templates (no backend seed)
                        </div>
                    )}

                    <div className="projects-grid">
                        {isLoading && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--primary-color)' }}>Loading templates...</p>}
                        {isError && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'red' }}>Could not load templates.</p>}

                        {templates?.map((template) => (
                            <div
                                key={template.id}
                                className="project-card"
                                onClick={() => createFromTemplateMutation.mutate(template.id)}
                                style={{
                                    opacity: createFromTemplateMutation.isPending ? 0.6 : 1,
                                    pointerEvents: createFromTemplateMutation.isPending ? 'none' : 'auto'
                                }}
                            >
                                <div className="project-preview-container">
                                    {template.thumbnailUrl ? (
                                        <img
                                            src={template.thumbnailUrl}
                                            alt={template.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div className="project-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', color: '#64748b' }}>
                                            No preview
                                        </div>
                                    )}
                                    <div className="project-overlay">
                                        <button className="button-agree">
                                            {createFromTemplateMutation.isPending ? 'Creating...' : 'Use Template'}
                                        </button>
                                    </div>
                                </div>

                                <div className="project-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'left' }}>
                                        <span className="project-name">{template.title}</span>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                            {template.ownerId === null ? 'System Template' : 'User Template'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {templates?.length === 0 && !isLoading && (
                            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>
                                No templates available yet. Save a project as a template in the Editor to see it here!
                            </p>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}