<?php

namespace App\Http\Controllers;

use App\Models\Notificacion;
use App\Services\NotificacionService;
use Illuminate\Http\Request;

class NotificacionController extends Controller
{
    public function __construct(private NotificacionService $notificacionService)
    {
    }

    public function index(Request $request)
    {
        $notificaciones = Notificacion::where('fk_id_usuario', $request->user()->id_usuario)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($notificaciones);
    }

    public function unreadCount(Request $request)
    {
        $count = Notificacion::where('fk_id_usuario', $request->user()->id_usuario)
            ->where('is_read', false)
            ->count();

        return response()->json(['unread' => $count]);
    }

    public function markRead(Request $request, $id)
    {
        $notificacion = Notificacion::where('fk_id_usuario', $request->user()->id_usuario)
            ->findOrFail($id);

        $notificacion->update(['is_read' => true]);

        return response()->json(['message' => 'Notificación marcada como leída']);
    }

    public function markAllRead(Request $request)
    {
        Notificacion::where('fk_id_usuario', $request->user()->id_usuario)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['message' => 'Todas las notificaciones fueron leídas']);
    }
}