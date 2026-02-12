# AdControl Cross-Platform App

Адаптивное приложение по вашим макетам с поддержкой:
- ✅ Browser/Web (готово сразу)
- ✅ Android/iOS через Capacitor
- ✅ macOS/Linux через Electron

## Быстрый запуск (Web)
```bash
python3 -m http.server 4173 --directory frontend
```
Откройте: `http://localhost:4173`.

## Android/iOS
1. Установить зависимости в среде с доступом к npm:
   ```bash
   npm i @capacitor/cli @capacitor/core
   npx cap add android
   npx cap add ios
   ```
2. Синхронизировать web-часть:
   ```bash
   npx cap sync
   ```
3. Открыть нативные IDE:
   ```bash
   npx cap open android
   npx cap open ios
   ```

## macOS/Linux
1. Установить Electron:
   ```bash
   npm i --save-dev electron
   ```
2. Запустить shell:
   ```bash
   npx electron frontend/electron.main.js
   ```

## Что реализовано
- Десктопный layout с боковой навигацией и картой.
- Мобильный layout с нижними вкладками и карточками задач.
- Экраны: Аналитика, Адреса, Наряды, Исполнители, Гайды.
- PWA manifest + service worker для offline-кеша.
