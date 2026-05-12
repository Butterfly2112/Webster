import { useState } from 'react'; // Додано useState
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '../api/http';
import Header from '../components/Header';
import Footer from '../components/Footer';

export interface ProjectCard {
    id: number;
    title: string;
    description?: string;
    width: number;
    height: number;
    thumbnailUrl?: string;
    isTemplate: boolean;
    updatedAt: string;
    ownerId: number;
}

export default function Home() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Стан для модального вікна видалення
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

    const { data: projects, isLoading, isError } = useQuery<ProjectCard[]>({
        queryKey: ['projects'],
        queryFn: async () => {
            const response = await customFetch('/api/project');
            if (!response.ok) throw new Error('Failed to fetch projects');
            return response.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const formData = new FormData();
            formData.append('title', 'Untitled Design');
            formData.append('width', '800');
            formData.append('height', '600');

            const response = await customFetch('/api/project/create', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Failed to create project');
            return response.json();
        },
        onSuccess: (newProject) => {
            navigate(`/editor/${newProject.id}`);
        },
        onError: (err) => {
            console.error('Project creation failed:', err);
            alert('Failed to create a new project. Please try again.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const response = await customFetch(`/api/project/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete project');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            // Закриваємо модалку після успішного видалення
            setIsDeleteModalOpen(false);
            setProjectToDelete(null);
        },
        onError: (err) => {
            console.error('Project deletion failed:', err);
            alert('Failed to delete the project. Please try again.');
            setIsDeleteModalOpen(false);
        }
    });

    // Відкриває модалку
    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setProjectToDelete(id);
        setIsDeleteModalOpen(true);
    };

    // Підтверджує видалення
    const confirmDelete = () => {
        if (projectToDelete !== null) {
            deleteMutation.mutate(projectToDelete);
        }
    };

    // Скасовує видалення
    const cancelDelete = () => {
        setIsDeleteModalOpen(false);
        setProjectToDelete(null);
    };

    return (
        <div className="app">
            <Header />
            <main className="home-page">
                <div className="home-container">
                    <header className="home-header">
                        <div className="header-content">
                            <h1>Greetings, {user?.username || user?.login}!</h1>
                            <p className="subtitle">Ready to build something beautiful today?</p>
                        </div>
                    </header>

                    <div className="projects-grid">
                        <div
                            className="project-card create-card"
                            onClick={() => createMutation.mutate()}
                            style={{ opacity: createMutation.isPending ? 0.6 : 1, pointerEvents: createMutation.isPending ? 'none' : 'auto' }}
                        >
                            <div className="create-icon">
                                {createMutation.isPending ? ' ' : '+'}
                            </div>
                            <span>{createMutation.isPending ? 'Creating...' : 'Create New Project'}</span>
                        </div>

                        {isLoading && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--primary-color)' }}>Loading your workspace...</p>}
                        {isError && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'red' }}>Could not load projects.</p>}

                        {projects?.map((project) => (
                            <div key={project.id} className="project-card" onClick={() => navigate(`/editor/${project.id}`)}>
                                <div className="project-preview-container">
                                    {project.thumbnailUrl ? (
                                        <img
                                            src={project.thumbnailUrl}
                                            alt={project.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div className="project-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', color: '#64748b' }}>
                                            No preview
                                        </div>
                                    )}
                                    <div className="project-overlay">
                                        <button className="button-agree">Open Editor</button>
                                    </div>
                                </div>

                                <div className="project-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'left' }}>
                                        <span className="project-name">{project.title}</span>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => handleDeleteClick(e, project.id)}
                                        title="Delete project"
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '5px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: 0.7,
                                            transition: 'opacity 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                    >
                                        <img
                                            src="/trash-icon.png"
                                            alt="Delete"
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <Footer />

            {/* --- МОДАЛЬНЕ ВІКНО ВИДАЛЕННЯ --- */}
            {isDeleteModalOpen && (
                <div className="modal-overlay" onClick={cancelDelete}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '300px', textAlign: 'center', minWidth: 'auto' }}
                    >

                        <h2 style={{ color: 'var(--primary-color)', marginBottom: '10px', fontSize: '22px' }}>Delete Project?</h2>

                        <p style={{ color: 'var(--text-light)', marginBottom: '30px', fontSize: '15px' }}>
                            Are you sure you want to delete this project? This action cannot be undone.
                        </p>

                        <div className="modal-actions"
                             style={{
                                 display: 'flex',
                                 justifyContent: 'space-between',
                                 width: '100%',
                                 marginTop: '20px'
                             }}>
                            <button className="button-secondary" style={{marginRight: '50px'}} onClick={cancelDelete}>
                                Cancel
                            </button>
                            <button
                                className="button-secondary"
                                onClick={confirmDelete}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}