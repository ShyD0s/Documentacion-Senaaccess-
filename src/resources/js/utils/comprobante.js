import axios from 'axios';

// Descarga el comprobante PDF de un equipo registrado.
// El token viaja por el interceptor global de axios (bootstrap.js).
const downloadComprobante = async (idEquipo) => {
    const response = await axios.get(`/api/my-equipment/${idEquipo}/comprobante`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    link.download = match ? match[1] : `comprobante-${idEquipo}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export default downloadComprobante;
