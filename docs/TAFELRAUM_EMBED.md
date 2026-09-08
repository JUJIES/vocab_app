# Tafelraum-Einbettung

Lerndeck besitzt einen bewusst begrenzten Lehrer-Einbettungsmodus für Tafelraum:

- Einstieg: `/teacher?embed=tafelraum`
- nur konfigurierte Tafelraum-Origins dürfen die Seite per CSP `frame-ancestors` einbetten;
- `TAFELRAUM_EMBED_ORIGINS` enthält eine kommagetrennte Liste vollständiger HTTPS-Origins; für lokale Entwicklung sind ausschließlich Loopback-HTTP-Origins erlaubt;
- API-Aufrufe des eingebetteten Clients tragen `X-Lerndeck-Embed: tafelraum`;
- die Einbettung verwendet ein eigenes, serverseitiges 30-Tage-Sitzungscookie. Unter HTTPS ist es `HttpOnly`, `Secure`, `SameSite=None` und `Partitioned`; das normale Lehrer-Cookie bleibt getrennt und `SameSite=Lax`;
- Passwörter und Sitzungstokens werden nie an Tafelraum übergeben oder dort gespeichert;
- der kleine `postMessage`-Vertrag meldet Bereitschaft und gibt Canvas-Pan/Zoom nur an den bereits vorhandenen Tafelraum-Interaktionspfad weiter.
- die vertrauten Browserkürzel `⌘/Strg +`, `⌘/Strg −` und `⌘/Strg 0` werden ausschließlich im eingebetteten Modus als App-Inhaltszoom an Tafelraum weitergereicht; Zeichenwert, deutsche physische Plus-Taste und Ziffernblock werden dabei layoutstabil normalisiert, während in der eigenständigen Lerndeck-App der normale Browserzoom zuständig bleibt;
- die Übungskarte koppelt ihre Breite im Tafelraum-Frame nicht an dessen aktuelle Höhe. Bei einer niedrigeren sichtbaren App-Fläche bleibt die Karte stabil und der vorhandene vertikale Scrollweg übernimmt; Aufdecken, Wischen und die normale 3D-Darstellung bleiben unverändert.
- Änderungen am Embed-Bridgecode benötigen eine neue Queryversion von `tafelraum-embed.js` in beiden HTML-Einstiegen und gegebenenfalls der aufrufenden Appdatei, damit vorhandene Lerndeck-Service-Worker keinen älteren Framevertrag ausliefern.

Der Modus ist keine allgemeine Freigabe zur Einbettung auf fremden Seiten. Weitere Host-Origins werden nur bewusst in der Dienstkonfiguration ergänzt.
