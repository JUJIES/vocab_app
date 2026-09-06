# Tafelraum-Einbettung

Lerndeck besitzt einen bewusst begrenzten Lehrer-Einbettungsmodus für Tafelraum:

- Einstieg: `/teacher?embed=tafelraum`
- nur konfigurierte Tafelraum-Origins dürfen die Seite per CSP `frame-ancestors` einbetten;
- `TAFELRAUM_EMBED_ORIGINS` enthält eine kommagetrennte Liste vollständiger HTTPS-Origins; für lokale Entwicklung sind ausschließlich Loopback-HTTP-Origins erlaubt;
- API-Aufrufe des eingebetteten Clients tragen `X-Lerndeck-Embed: tafelraum`;
- die Einbettung verwendet ein eigenes, serverseitiges 30-Tage-Sitzungscookie. Unter HTTPS ist es `HttpOnly`, `Secure`, `SameSite=None` und `Partitioned`; das normale Lehrer-Cookie bleibt getrennt und `SameSite=Lax`;
- Passwörter und Sitzungstokens werden nie an Tafelraum übergeben oder dort gespeichert;
- der kleine `postMessage`-Vertrag meldet Bereitschaft und gibt Canvas-Pan/Zoom nur an den bereits vorhandenen Tafelraum-Interaktionspfad weiter.

Der Modus ist keine allgemeine Freigabe zur Einbettung auf fremden Seiten. Weitere Host-Origins werden nur bewusst in der Dienstkonfiguration ergänzt.
