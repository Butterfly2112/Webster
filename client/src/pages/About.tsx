import { Link } from 'react-router-dom';

export default function About() {
    return (
        <div className="about-page">
            <div className="about-content">

                <div className="about-gallery">
                    <img
                        src="/screen1.png"
                        alt="Brawy Tools"
                        className="gallery-img img-1"
                    />
                    <img
                        src="/screen2.png"
                        alt="Brawy Layers"
                        className="gallery-img img-2"
                    />
                    <img
                        src="/screen3.png"
                        alt="Brawy Canvas"
                        className="gallery-img img-3"
                    />
                </div>

                <div className="about-text-section">
                    <h4 className="subtitle">About Brawy</h4>
                    <h1>Create masterpieces right in your browser</h1>
                    <p className="main-description">
                        Brawy is a modern browser-based graphics editor designed to make
                        the process of creating graphics fast, convenient, and accessible
                        to everyone, without the need to install heavy programs.
                    </p>

                    <div className="features-list">
                        <div className="feature-item">
                            <div className="feature-icon">&#x1F3A8;</div>
                            <div>
                                <strong>Intuitive interface</strong>
                                <p>All the necessary tools, layers, and filters are always at hand.</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">&#x26A1;</div>
                            <div>
                                <strong>Lightning speed</strong>
                                <p>Using modern web technologies for smooth operation without delays.</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">&#x2601;</div>
                            <div>
                                <strong>Cloud synchronization</strong>
                                <p>Your projects are stored in the system and accessible from any device.</p>
                            </div>
                        </div>
                    </div>

                    <Link to="/projects" className="button-agree">
                        Start work
                    </Link>
                </div>

            </div>
        </div>
    );
}