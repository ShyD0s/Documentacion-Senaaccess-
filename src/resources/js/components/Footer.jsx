import React from 'react';

const Footer = () => {
    // Obtener el año actual para mostrar en el pie de página, esto para mantenerlo actualizado automáticamente cada año sin necesidad de editar el código
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-auto text-center w-100 footer-text mb-0">
            <div className="container-fluid">
                <div className="row justify-content-center align-items-center g-2">
                    <div className="col-12 col-md-auto">
                        <p className="mb-0 fw-bold">
                            <span className="text-success">Sena</span>Access
                            <span className="ms-2 badge rounded-pill bg-success opacity-75" style={{ fontSize: '0.65rem' }}>v9.0</span>
                        </p>
                    </div>
                    <div className="col-12 col-md-auto d-none d-md-block">
                        <span className="mx-2 opacity-25">|</span>
                    </div>
                    <div className="col-12 col-md-auto">
                        <p className="mb-0 small opacity-75">
                            © {currentYear} SENA &amp; SCS. Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
