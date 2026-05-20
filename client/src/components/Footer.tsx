import {Link} from "react-router-dom";

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">

                {/* LEFT: logo + description */}
                <div className="footer-section" style={{  maxWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                        <img src="/logo.png" alt="logo" style={{width: '40px', height: '40px', borderRadius: '10px'}}/>
                        <span style={{fontSize: '18px', fontWeight: 'bold'}}>Brawy</span>
                    </div>

                    <p className="footer-description" style={{ fontSize: '14px', lineHeight: '1.5'}}>
                        Brawy is an online platform for creating, editing, and managing
                        web projects. Choose templates, create your own designs, and
                        implement your ideas quickly and conveniently.
                    </p>
                </div>

                {/* CONTACTS */}
                <div className="footer-section" style={{  maxWidth: '300px' }}>
                    <h4>Contacts</h4>
                    <p>Email: support@brawy.com</p>
                    <p>Phone: +380 00 000 00 00</p>
                    <p>Ukraine</p>
                </div>

                {/* NAV */}
                <div className="footer-section" style={{  maxWidth: '300px' }}>
                    <h4>Navigation</h4>
                    <nav className="nav-links">
                        <Link to="/templates">Templates</Link>
                        <Link to="/projects">My projects</Link>
                        <Link to="/about">About us</Link>
                    </nav>
                </div>

            </div>

            {/* BOTTOM */}
            <div className="footer-bottom">
                <p>© {new Date().getFullYear()} Brawy. All rights reserved.</p>
            </div>
        </footer>
    );
}