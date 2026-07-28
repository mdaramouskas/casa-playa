# epay eCommerce / Paycenter Redirection — τι χρειαζόμαστε και από ποιον

Αναφορά: **Redirection Manual Ver 3.1 EL (01/07/2026)**, ενότητες 3, 4, 5, 7, 10.

## 0. Ποιον ρωτάμε

Το προϊόν λέγεται εμπορικά **«epay eCommerce»**, τρέχει πάνω στο **Paycenter της Τράπεζας Πειραιώς** (`paycenter.piraeusbank.gr`) και το διαχειρίζεται η **Euronet Merchant Services**. Είναι ένα πράγμα — δεν υπάρχει ξεχωριστή ενέργεια «σύνδεση με Πειραιώς».

- **Εμπορικά** (σύμβαση, τιμολόγηση, ενεργοποίηση IRIS / δόσεων / Amex): ο εμπορικός εκπρόσωπος της Euronet Merchant Services ή το κατάστημα της Πειραιώς που έφερε τη συνεργασία.
- **Τεχνικά** (test account, credentials, WSDL, δηλωμένα URL): το τεχνικό τμήμα υποστήριξης της Euronet — μας το δίνει ο εμπορικός μόλις υπογραφεί η σύμβαση (§10, βήμα 1).

Σε κάθε επικοινωνία για πρόβλημα συναλλαγής δίνουμε το **SupportReferenceID** — το αποθηκεύουμε πάντα.

---

## 1. Τι στέλνουμε εμείς για να ανοίξει test account (§3)

Όλα υποχρεωτικά. Τα τεχνικά τα ξέρουμε ήδη· τα εμπορικά θέλουν επιβεβαίωση από τον πελάτη.

**Στοιχεία τεχνικού υπευθύνου**
- Ονοματεπώνυμο
- Τηλέφωνο
- Email
- Εταιρία

**Στοιχεία επιχείρησης**
- Διακριτικός τίτλος
- ΑΦΜ
- Domain name του live site

**Τεχνικά στοιχεία** (`<domain>` = το τελικό domain — πρέπει να είναι **ίδιο με αυτό της σύμβασης**)

| Πεδίο | Τιμή |
|---|---|
| Web site URL | `https://<domain>` |
| Referrer URL | `https://<domain>/pay/handoff` |
| Success URL | `https://<domain>/api/payment/callback` |
| Failure URL | `https://<domain>/api/payment/callback` |
| Backlink URL (κουμπί «Ακύρωση») | `https://<domain>/payment/failure` |
| IP address | **η στατική IP του server που καλεί το ticketing WS — βλ. §4 παρακάτω** |
| Μέθοδος απάντησης | **POST** |
| Υποστήριξη δόσεων | **Όχι** |

> Success και Failure είναι σκόπιμα το **ίδιο** URL: το αποτέλεσμα το κρίνουμε από `ResultCode` + `StatusFlag`, ποτέ από το ποιο URL χτυπήθηκε. Αν επιμείνουν σε δύο διαφορετικά, ζητάμε να τα δηλώσουν και τα δύο και προσθέτουμε δεύτερο route.
>
> Τα URL δηλώνονται **ανά PosId**. Αν χρειαστούμε staging + production ταυτόχρονα, ζητάμε **δύο PosId**.

---

## 2. Τι πρέπει να πάρουμε πίσω (§3, §10)

Πέντε τιμές, **δύο φορές** — μία για το test account και μία για το live:

- `AcquirerId`
- `MerchantId`
- `PosId`
- `Username`
- `Password` (σε καθαρή μορφή· εμείς το στέλνουμε MD5-hashed)

Μπαίνουν στα `PAYCENTER_ACQUIRER_ID / _MERCHANT_ID / _POS_ID / _USERNAME / _PASSWORD` και το `PAYCENTER_MODE` γίνεται `test` → `live`.

> **Προσοχή:** δεν υπάρχει ξεχωριστό sandbox host. Test και live χρησιμοποιούν **τα ίδια endpoints** και διαφέρουν μόνο στα credentials.

Επίσης:
- Πρόσβαση στο **AdminTool** (παρακολούθηση συναλλαγών, ολοκλήρωση προεγκρίσεων) — usernames για τους υπευθύνους του καταστήματος.
- Email της επιχείρησης για τα αυτόματα ενημερωτικά (§5) και ποια είδη θέλουμε (μόνο επιτυχείς / και ανεπιτυχείς / εγκατάλειψη σελίδας).

---

## 3. Τεχνικές διευκρινίσεις

### ✅ Το SOAP contract — λύθηκε, δεν χρειάζεται να ρωτηθεί

Το εγχειρίδιο δίνει το URL του ticketing WS αλλά όχι το envelope. Το **WSDL όμως είναι δημόσια προσβάσιμο** χωρίς credentials:

```
https://paycenter.piraeusbank.gr/services/tickets/issuer.asmx?WSDL
```

Διαβάστηκε στις 28/07/2026 και επιβεβαιώνει:

| | Τιμή |
|---|---|
| targetNamespace | `http://piraeusbank.gr/paycenter/redirection` |
| operation | `IssueNewTicket` |
| SOAPAction | `http://piraeusbank.gr/paycenter/redirection/IssueNewTicket` |
| request wrapper | `<Request>` τύπου `TicketRequest` (53 πεδία, `xsd:sequence`) |
| response | `IssueNewTicketResult` → `ResultCode`, `ResultDescription`, `TranTicket`, `Timestamp`, `MinutesToExpiration` |

Δύο πράγματα που **μόνο** το WSDL αποκαλύπτει και δεν γράφονται πουθενά στο εγχειρίδιο:

- Ο τύπος είναι `xsd:sequence` → **η σειρά των πεδίων είναι μέρος του συμβολαίου**. Η σειρά είναι `Username, Password, MerchantId, PosId, AcquirerId, MerchantReference, RequestType, ExpirePreauth, Amount, CurrencyCode, Installments, Bnpl, Parameters, …` — αισθητά διαφορετική από τη σειρά που τα παρουσιάζει το εγχειρίδιο.
- Δώδεκα πεδία 3D Secure είναι `minOccurs="1" nillable="true"`, δηλαδή πρέπει να **υπάρχουν** στο μήνυμα ακόμη κι όταν δεν έχουμε τιμή, με `xsi:nil="true"`: `RecurringInd, RecurFreq, AddressMatch, DeliveryTimeframe, ReorderItemsInd, PreOrderPurchaseInd, AuthMethod, AccountAgeInd, AccountChangeInd, AccountPwdChangeInd, ShipAddressUsageInd, SuspiciousAccActivity`.

Και τα δύο είναι υλοποιημένα και ελεγμένα στο `src/lib/paycenter/gateway.ts`.

### Παραμένουν ανοιχτά

1. **Follow-up Web Service** — προδιαγραφές, αν θελήσουμε επαναφορά χαμένης απάντησης (χρήσιμο αν ο πελάτης κλείσει το browser μετά τη χρέωση). Δεν δίνεται στο εγχειρίδιο, δίνεται κατόπιν αιτήματος.

2. Αν πάμε σε **PREAUTH**: προδιαγραφές του Web Service ολοκλήρωσης προέγκρισης (αλλιώς γίνεται χειροκίνητα από το AdminTool).

---

## 4. Το εμπόδιο με τη στατική IP

Το ticketing Web Service καλείται **μόνο** από server με **IP δηλωμένη εκ των προτέρων** στην Euronet (§3, §4 — δεν επιτρέπονται κλήσεις από browser/scripts). Το Vercel serverless **δεν έχει σταθερή IP εξόδου**.

Επιλογές:
1. Vercel υπηρεσία στατικής IP / dedicated egress (πληρωμένο add-on) — μικρότερη αλλαγή.
2. Ένα μικρό VPS/container με σταθερή IP που κάνει proxy **μόνο** την κλήση του ticketing WS.
3. Μετακίνηση όλου του app σε host με σταθερή IP.

**Χρειάζεται απόφαση πριν ζητήσουμε test account**, γιατί η IP δηλώνεται στην αίτηση. Ρωτάμε επίσης αν δέχονται **εύρος IP** ή περισσότερες από μία.

---

## 5. Εμπορικά ερωτήματα προς τον πελάτη / Euronet

| Ερώτημα | Πρόταση |
|---|---|
| Αγορά (`RequestType=02`) ή Προέγκριση (`00`); | **Αγορά** — ταιριάζει με την πολιτική μη επιστροφής χρημάτων. Η προέγκριση θέλει ξεχωριστή έγκριση από Euronet και ολοκλήρωση εντός 2–30 ημερών. |
| IRIS (άμεση χρέωση τραπεζικού λογαριασμού); | Προαιρετικό. Χωρίς δόσεις, δεν δουλεύει με προέγκριση. Αν το θέλουμε, ζητείται ενεργοποίηση. |
| Δόσεις; | Όχι. |
| Diners/Discover / American Express; | Χρειάζονται **ξεχωριστό MerchantId + PosId** και ξεχωριστή εμπορική διαδικασία. Προτείνω όχι στη φάση 1. |
| Νόμισμα | Μόνο EUR (`CurrencyCode=978`). Κάθε άλλο νόμισμα θέλει δικό του MerchantId/PosId. |
| Google Pay | Ενεργοποιείται αυτόματα, καμία ενέργεια από εμάς. |
| **Apple Pay;** | **Δεν γίνεται με Redirection.** Ο οδηγός «ApplePay GooglePay» περιγράφει αποκλειστικά direct integration: η επιχείρηση κάνει η ίδια διασύνδεση με Apple/Google και μετά στέλνει `CardNumber` (token), `CAVV`, `Eci`, `WalletType=2` στο Transaction Web Service. Με hosted σελίδα δεν αγγίζουμε ποτέ αυτά τα δεδομένα. Για Apple Pay θα έπρεπε να εγκαταλείψουμε το Redirection → PCI scope, δική μας φόρμα κάρτας, δικό μας 3DS. **Δεν το προτείνω.** Το Google Pay παραμένει διαθέσιμο, αυτόματα. |
| Παραμετροποίηση σελίδας πληρωμής (λογότυπο); | Προαιρετικό — στέλνουμε τροποποιημένο `default.css` (υπάρχει στον φάκελο `StyleSheet` των προδιαγραφών). |

---

## 6. Υποχρεώσεις στο site πριν πάμε live (§8)

Στην **αρχική σελίδα**:
- Εικονίδια καρτών: Visa, Mastercard, Maestro
- Badge **Visa Secure**
- Badge **Mastercard Identity Check**

Στη σελίδα ασφάλειας (αν υπάρχει): τα ίδια 3D-Secure badges.
Προαιρετικά: λογότυπο epay, λογότυπο IRIS.

Τα assets είναι στον φάκελο `Icons/` των προδιαγραφών (και στο <https://www.epayworldwide.gr/wp-content/uploads/2022/10/Icons.zip>).

Επίσης απαιτούμενα από τη σύμβαση/κανόνες σχημάτων: ορατή επωνυμία + ΑΦΜ + διεύθυνση, πολιτική ακύρωσης, τιμές με ΦΠΑ πριν την πληρωμή, πολιτική απορρήτου.

---

## 7. Υποχρεωτικά test cases (§7)

Με τα test credentials, πριν δοθεί live account:

| # | Σενάριο | Κάρτα |
|---|---|---|
| 1 | APPROVED (VISA) | `4908455555555557`, λήξη 01/οποιοδήποτε μελλοντικό έτος, CVV2 `123` |
| 2 | DECLINED | κατά το εγχειρίδιο |
| 3 | RECHARGE ATTEMPT | κατά το εγχειρίδιο |

Τα υπόλοιπα 13 είναι προαιρετικά. Στα test προέγκρισης το `ExpirePreauth` πρέπει να είναι **ακριβώς 30**.

Μετά την επιτυχή ολοκλήρωση ενημερώνουμε την Euronet, στέλνουμε τα live URL + live IP, και παίρνουμε το live account.

---

## 7β. Ποια εγχειρίδια χρειαζόμαστε

Από τη λίστα «Οδηγοί λύσεων eCommerce» του epay portal:

**Τα έχουμε και τα χρειαζόμαστε**
- **Redirection** — η λύση που υλοποιούμε.
- **Icons** — υποχρεωτικά εικονίδια (§8).

**Κατέβηκαν 28/07/2026 — τι έδωσαν**
- **Admin Tool manual v5.2** ✅ χρήσιμο. Πρόσβαση στο <https://paycenter.piraeusbank.gr/AdminTool/>. Καλύπτει αναζήτηση συναλλαγών, **ακύρωση και ολική/μερική επιστροφή**, προεγκρίσεις, αναφορές εκκαθάρισης, διαχείριση χρηστών. Βάση για τις οδηγίες παράδοσης στον πελάτη.
- **Virtual POS manual v2.3** — προαιρετικό. Χειροκίνητες χρεώσεις από call center. Σημαντική λεπτομέρεια: οι **επιστροφές/ακυρώσεις γίνονται μόνο από AdminTool και μόνο από χρήστη με δικαιώματα Administrator** — άρα ο πελάτης χρειάζεται τουλάχιστον έναν admin λογαριασμό.
- **Web Service manual v2.4** — δεν περιείχε SOAP envelope (μόνο το URL `…/services/paymentgateway.asmx`). Το κενό καλύφθηκε τελικά από το ίδιο το WSDL (§3).
- **ApplePay GooglePay Guide v1.0** — απάντησε το ερώτημα του Apple Pay: αφορά αποκλειστικά direct integration, βλ. §5.
- **BIN Web Service v2.0** — αφορά **μόνο** έλεγχο αν ένα BIN υποστηρίζει δόσεις. Δεν βάζουμε δόσεις.

**Μόνο αν αλλάξει απόφαση**
- **IRIS eCommerce Guide** — αν ενεργοποιήσουμε IRIS.
- **Report Files** — αν θελήσουμε συμφωνία εκκαθαρίσεων στο admin panel.
- **epay by link** — αν το κατάστημα θέλει τηλεφωνικές κρατήσεις με link πληρωμής.

**Δεν χρειάζονται**
- 3D Secure, Rest Web Service, Tokenization (τα έχουμε ήδη, αφορούν direct integration)
- Batch File, Recurring Transactions, Redirection (iFrame), Redirection Loyalty, Web Service Loyalty

---

## 8. Κατάσταση υλοποίησης

Έτοιμα και ελεγμένα (`src/lib/paycenter/`, `src/app/api/payment/callback`, `src/app/[locale]/pay/handoff`):

- Ticketing μηχανισμός (SOAP) — envelope **ελεγμένο πεδίο-πρoς-πεδίο απέναντι στο WSDL**: σωστό namespace, SOAPAction, `<Request>` wrapper, ακριβής σειρά 53 πεδίων, `xsi:nil` στα 12 υποχρεωτικά-nillable
- HTML form POST στο `pay.aspx` με τα πεδία του Παραρτήματος 1
- Επαλήθευση `HashKey` — **επαληθευμένη με το επίσημο παράδειγμα του Παραρτήματος 4** (`selfTest()` στο `hashkey.ts`)
- Idempotent χειρισμός απάντησης, αποθήκευση `SupportReferenceID` / `ApprovalCode` / `AuthStatus` κ.λπ.
- Mock gateway που παράγει τα **πραγματικά** ονόματα παραμέτρων και πραγματικό HashKey

Εκκρεμούν **δύο** πράγματα, κανένα από τα οποία δεν είναι κώδικας:

1. Τα **5 credentials** από την Euronet.
2. Η απόφαση για τη **στατική IP** (§4).
