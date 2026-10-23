#!/usr/bin/env bash
# SenaAccess — arranque manual (opcional).
# El servicio systemd usuario "sennaccess" ya mantiene el servidor Laravel vivo
# y aplica adb reverse automáticamente al conectar el celular por USB.
# Este script solo fuerza un ciclo inmediato y muestra el estado.

ADB=/home/andres/android-sdk/platform-tools/adb
LOG="$HOME/.local/share/sennaccess-watcher.log"

echo "== Estado del servicio =="
systemctl --user is-active sennaccess.service && echo "(watcher activo: no hace falta nada más)" || {
    echo "Servicio inactivo; iniciándolo..."
    systemctl --user enable --now sennaccess.service
}

echo "== Dispositivos =="
"$ADB" devices

echo "== Reverse actual =="
"$ADB" reverse --list 2>/dev/null || true

echo "Log del watcher: $LOG"
