import { defineConfig } from 'vite'; //import vite
import laravel from 'laravel-vite-plugin'; //import plugin vite laravel 
import react from '@vitejs/plugin-react'; // import de react 

export default defineConfig({ 
    plugins: [
        laravel({
            input: [
                'resources/css/app.css', 
                'resources/js/app.jsx' // 
            ],
            refresh: true,
        }),
        react(), 
    ]
});