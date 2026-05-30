const express = require('express');
const session = require('express-session');
const path = require('path'); 
const db = require('./database'); 
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Correction Vercel pour servir les fichiers statiques à la racine
app.use(express.static(path.join(__dirname, '.')));

app.use(session({
    secret: 'srmcs_secret_key_2026',
    resave: false,
    saveUninitialized: false
}));

// Force le bon type MIME pour le fichier CSS
app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, 'style.css'));
});

// Déclaration explicite de toutes les routes HTML pour Vercel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/saisie.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'saisie.html'));
});

app.get('/responsable.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'responsable.html'));
});

// 1. Route de connexion
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE LOWER(username) = $1", [username.toLowerCase()]);
        const user = result.rows[0]; 

        if (user && user.password === password) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            req.session.metier = user.metier;
            
            if (user.role === 'responsable') {
                res.redirect('/responsable.html');
            } else {
                res.redirect('/saisie.html');
            }
        } else {
            res.send("<h3>Identifiants incorrects. <a href='/'>Réessayer</a></h3>");
        }
    } catch (err) {
        res.status(500).send("Erreur serveur : " + err.message);
    }
});

app.get('/api/user-info', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' });
    res.json({ username: req.session.username, role: req.session.role, metier: req.session.metier });
});

// 2. Route d'ajout de commande
app.post('/api/commandes', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ca') return res.status(403).send('Accès refusé');
    
    const { num_commande, projet, montant, etat } = req.body;
    const metier = req.session.metier;

    try {
        await db.query(
            `INSERT INTO commandes (num_commande, projet, montant, etat, metier, cree_par) VALUES ($1, $2, $3, $4, $5, $6)`,
            [num_commande, projet, montant, etat, metier, req.session.username]
        );
        res.redirect('/saisie.html?success=true');
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

// 3. Route Historique pour le Chargé d'Affaires connecté
app.get('/api/commandes/mes-saisies', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ca') return res.status(403).json({ error: 'Accès refusé' });
    
    try {
        const result = await db.query("SELECT * FROM commandes WHERE cree_par = $1 ORDER BY id DESC", [req.session.username]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [NOUVEAU] Route de modification de l'état d'une commande
app.put('/api/commandes/:id', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ca') return res.status(403).json({ error: 'Accès refusé' });
    
    const { id } = req.params;
    const { etat } = req.body;

    try {
        const result = await db.query(
            `UPDATE commandes SET etat = $1, updated_at = NOW() WHERE id = $2 AND cree_par = $3`,
            [etat, id, req.session.username]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Commande non trouvée ou non autorisée" });
        }
        
        res.json({ success: true, message: "État mis à jour avec succès" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Route Responsable avec tri obligatoire (Assainissement, Eau, Electricite)
app.get('/api/commandes/all', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'responsable') return res.status(403).json({ error: 'Accès refusé' });
    
    const sql = `
        SELECT * FROM commandes 
        ORDER BY 
            CASE metier
                WHEN 'Assainissement' THEN 1
                WHEN 'Eau' THEN 2
                WHEN 'Electricite' THEN 3
                ELSE 4
            END, id DESC`;

    try {
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/'); });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Serveur actif sur le port : ${PORT}`); });

module.exports = app;
