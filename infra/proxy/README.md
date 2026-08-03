# Ο proxy της στατικής IP

## Γιατί υπάρχει

Το ticketing Web Service του Paycenter απαντά **μόνο** σε κλήσεις από IP δηλωμένη
εκ των προτέρων στη Euronet (Redirection manual §3, §4). Οι συναρτήσεις του
Vercel δεν έχουν σταθερή IP εξόδου. Οπότε **μία και μόνο κλήση** της εφαρμογής —
το `IssueNewTicket` — περνάει από αυτό το μηχάνημα, και η Euronet βλέπει πάντα
την ίδια διεύθυνση.

Τίποτα άλλο δεν περνάει από εδώ: ο browser του πελάτη πάει κατευθείαν στο
`pay.aspx`, και η απάντηση της τράπεζας έρχεται στα δημόσια routes μας.

| | |
|---|---|
| Μηχάνημα | Hetzner CPX12, Nuremberg, `casa-playa-proxy` |
| IP (αυτή δηλώνεται στη Euronet) | `46.224.113.245` |
| Λειτουργικό | Ubuntu 26.04 LTS |
| Λογισμικό | Squid 7.2 (`squid-openssl`) |
| Θύρα proxy | `8443`, TLS |
| Χρήστης proxy | `casaplaya` |
| Επιτρεπόμενος προορισμός | `paycenter.piraeusbank.gr:443`, **μόνο** |

Η IP είναι Hetzner Primary IP με **auto-delete off** και **protection on**. Δεν
πρέπει ποτέ να αποδεσμευτεί: αν αλλάξει, οι πληρωμές σταματούν μέχρι να
δηλωθεί ξανά η νέα διεύθυνση στη Euronet.

## Πώς είναι κλειδωμένος

Τέσσερα ανεξάρτητα επίπεδα, το καθένα από τα οποία αρκεί για να αποτύχει μια
κατάχρηση:

1. **TLS με καρφωμένο πιστοποιητικό.** Ο proxy μιλάει TLS με αυτο-υπογεγραμμένο
   πιστοποιητικό (10 έτη, SAN `IP:46.224.113.245`). Η εφαρμογή το εμπιστεύεται
   ρητά και **μόνο αυτό** (`proxyTls.ca`), οπότε δεν παίζει ρόλο καμία από τις
   ~150 δημόσιες ρίζες — για πλαστοπροσωπία χρειάζεται το ιδιωτικό κλειδί του
   μηχανήματος. Παρενέργεια: δεν υπάρχει DNS εξάρτηση, ούτε Let's Encrypt, ούτε
   ανανέωση που μπορεί να λήξει και να κόψει πληρωμές.
2. **Μυστικό, όχι λίστα IP.** Ο περιορισμός σε IP πηγής είναι αδύνατος — αυτός
   ακριβώς είναι ο λόγος που υπάρχει ο proxy. Οπότε Basic auth μέσα στο TLS.
3. **Ένας προορισμός.** Επιτρέπεται μόνο `CONNECT paycenter.piraeusbank.gr:443`.
   Οτιδήποτε άλλο παίρνει `403` πριν καν ζητηθεί συνθηματικό — άρα ακόμη κι αν
   διαρρεύσει το μυστικό, το μόνο που κερδίζει κάποιος είναι να μιλήσει στην
   τράπεζα, όχι ανοιχτός proxy.
4. **Firewall + ενημερώσεις.** `ufw`: μόνο 22 και 8443 δεκτά, όλα τα άλλα
   εισερχόμενα απορρίπτονται. SSH μόνο με κλειδί. `unattended-upgrades` με
   αυτόματη επανεκκίνηση στις 04:30 όταν το απαιτεί ενημέρωση πυρήνα/OpenSSL.

Η θύρα 8443 είναι ανοιχτή σε όλο το διαδίκτυο κατ' ανάγκη. Το `access.log`
δείχνει ήδη σαρώσεις από άγνωστες διευθύνσεις· όλες σταματούν στο TLS ή στο
`407`.

## Ρύθμιση στην εφαρμογή

Οι μεταβλητές μπαίνουν στο Vercel (Production + Preview) — βλ. `.env.example`:

```
PAYCENTER_PROXY_URL=https://46.224.113.245:8443
PAYCENTER_PROXY_USER=casaplaya
PAYCENTER_PROXY_PASSWORD=<το μυστικό>
PAYCENTER_PROXY_CA=<το PEM, ή base64 του PEM>
```

Ο κώδικας είναι στο `src/lib/paycenter/egress.ts`. Δύο σημεία που κόστισαν χρόνο
και δεν είναι προφανή:

- Χρησιμοποιείται το `fetch` **της undici**, όχι το global. Το Node έχει δικό του
  ενσωματωμένο αντίγραφο της undici, και ένας dispatcher από το πακέτο μας
  σκάει στο global `fetch` με `invalid onRequestStart method`.
- Χωρίς `PAYCENTER_PROXY_URL` η κλήση **αποτυγχάνει επίτηδες** όταν υπάρχουν
  πραγματικά credentials, αντί να φύγει από αδήλωτη διεύθυνση και να την κόψει η
  Euronet με μήνυμα που δεν λέει τίποτα. Ρητή διέξοδος:
  `PAYCENTER_ALLOW_DIRECT_EGRESS=1`.

## Έλεγχος ότι δουλεύει

```bash
PAYCENTER_PROXY_PASSWORD=… node infra/proxy/check.mjs
```

Ελέγχει και τις τέσσερις ιδιότητες για τις οποίες υπάρχει ο proxy — φτάνει στην
τράπεζα, αρνείται λάθος μυστικό, αρνείται άλλον προορισμό, και η ταυτότητά του
κρέμεται από το καρφωμένο πιστοποιητικό και όχι από τις δημόσιες ρίζες:

```
ok    reaches paycenter                  HTTP 200
ok    refuses a wrong secret             0
ok    refuses no secret                  0
ok    refuses another destination        0
ok    is trusted only via the pin        DEPTH_ZERO_SELF_SIGNED_CERT
```

Το `proxy.crt` δίπλα σε αυτό το README είναι το **δημόσιο** πιστοποιητικό του
proxy — δεν είναι μυστικό, γι' αυτό και βρίσκεται στο repo. Το ιδιωτικό κλειδί
δεν φεύγει ποτέ από το μηχάνημα.

Σε ζωντανή κίνηση:

```bash
ssh root@46.224.113.245 'tail -f /var/log/squid/access.log'
```

Μια επιτυχημένη κλήση φαίνεται ως:

```
… TCP_TUNNEL/200 7712 CONNECT paycenter.piraeusbank.gr:443 casaplaya HIER_DIRECT/195.39.236.163 -
```

`TCP_DENIED/407` = λάθος ή απόν μυστικό. `TCP_DENIED/403` = κάποιος ζήτησε άλλο
προορισμό. Όταν η Euronet ρωτάει για συγκεκριμένη συναλλαγή, αυτό το αρχείο
δείχνει αν φύγαμε καν από εδώ.

## Αλλαγή του μυστικού

```bash
ssh root@46.224.113.245
PASS=$(openssl rand -hex 24)
printf 'casaplaya:%s\n' "$(openssl passwd -6 "$PASS")" > /etc/squid/passwd
chown root:proxy /etc/squid/passwd && chmod 0640 /etc/squid/passwd
systemctl reload squid
echo "$PASS"   # → Vercel: PAYCENTER_PROXY_PASSWORD, μετά redeploy
```

## Ξαναστήσιμο από το μηδέν

Αν χαθεί το μηχάνημα, η **IP είναι το μόνο μη αναπληρώσιμο**: κράτα το ίδιο
Primary IP στο νέο server, αλλιώς χρειάζεται νέα δήλωση στη Euronet.

```bash
apt-get update && apt-get install -y squid-openssl

install -d -m 0750 -o root -g proxy /etc/squid/tls
# προσοχή: το SAN πρέπει να είναι η πραγματική IP
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -sha256 \
  -keyout /etc/squid/tls/proxy.key -out /etc/squid/tls/proxy.crt \
  -subj "/CN=casa-playa-proxy/O=Casa Playa" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign" \
  -addext "extendedKeyUsage=serverAuth" \
  -addext "subjectAltName=IP:46.224.113.245"
chown root:proxy /etc/squid/tls/proxy.*
chmod 0640 /etc/squid/tls/proxy.key

# squid.conf: το αρχείο δίπλα σε αυτό το README, αυτούσιο
# passwd: όπως στην ενότητα «Αλλαγή του μυστικού»
squid -k parse && systemctl enable --now squid

ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 8443/tcp && ufw --force enable
```

Μετά: νέο `PAYCENTER_PROXY_CA` και `PAYCENTER_PROXY_PASSWORD` στο Vercel, επειδή
το πιστοποιητικό είναι καρφωμένο.
