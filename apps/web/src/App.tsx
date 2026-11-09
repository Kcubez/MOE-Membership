import { TelegramLink } from './console/TelegramLink';
import { ConsoleApp } from './console/ConsoleApp';

export function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/telegram/link')
    return <TelegramLink />;
  return <ConsoleApp />;
}
