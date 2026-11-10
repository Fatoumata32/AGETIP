# AGETIP — Informatique & technique

Interface React/TypeScript responsive inspirée des captures fournies. L’application réunit un tableau de bord, les modules opérationnels, les rapports, un espace documentaire et l’assistant AGETIP.

## Démarrer

```sh
npm install
npm run dev:all
```

`npm run build` vérifie les types TypeScript puis génère le site dans `dist/`.

### Configuration locale

Renseigner les valeurs réelles dans `.env.local` avant de démarrer l’application avec un environnement réel :

```dotenv
PORT=4000
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
```

Les variables `VITE_*` sont exposées au navigateur. N’y mettre que l’URL du projet et sa clé publishable/anon ; ne jamais y mettre `SUPABASE_SECRET_KEY`, une clé `service_role` ou un mot de passe de base de données. Le client Supabase utilise cette configuration pour Auth et le Data API.

### Activer Supabase

1. Le schéma initial et `202610280001_app_records.sql` sont déjà appliqués sur le projet actuel. Appliquer `supabase/migrations/202610280002_workspace_features.sql`, puis `supabase/migrations/202611100001_personnel_directory.sql` dans le SQL Editor. La seconde migration active le répertoire partagé du personnel.
2. Dans Authentication, activer l’inscription par e-mail et configurer les URL de redirection utilisées par l’application.
3. Créer un compte dans l’application et attribuer les rôles nécessaires dans `public.user_profiles`. Les nouveaux comptes ont le rôle `reader` par défaut.

Dans **Paramètres**, le bouton **Transférer les données locales** importe les enregistrements présents dans le `localStorage` de ce navigateur, sans écraser ceux déjà présents dans Supabase et sans effacer la copie locale. Les documents binaires ne sont pas inclus dans ce transfert.

### Documents et assistant local

1. Installer Ollama sur la machine qui exécute le backend et télécharger le modèle configuré :

```sh
ollama pull qwen2.5:3b
```

2. Vérifier `OLLAMA_BASE_URL` et `OLLAMA_MODEL` dans `.env.local`, puis démarrer le backend avec `npm run dev:all`. Pour un déploiement, le backend doit pouvoir joindre Ollama sur son réseau.
3. Les administrateurs et techniciens peuvent charger des documents PDF, Word ou texte dans le bucket privé `agetip-documents`. Le texte extrait est conservé dans ce bucket privé. L’assistant recherche les passages pertinents et les envoie au serveur Ollama local ; les réponses affichent les noms des documents utilisés.

Les utilisateurs authentifiés peuvent lire les documents. Le chargement et la suppression sont réservés aux administrateurs et techniciens par les politiques RLS. Les données métier, préférences, historiques et métadonnées sont stockés dans `public.app_records`; profils et rôles restent dans `public.user_profiles`.

## Fonctionnalités de cette première version

- Navigation responsive et tableau de bord avec accès direct aux incidents, équipements et maintenances.
- Répertoire recherchable du personnel avec e-mail AGETIP, fonction et service ; gestion réservée aux administrateurs sur Supabase.
- Ajout et modification des factures SONATEL, articles et mouvements de cartouches, équipements informatiques, climatiseurs et maintenances ; sauvegarde dans Supabase avec compte connecté, sinon dans le mode local/API de développement.
- Import de factures SONATEL depuis Excel (`.xls`, `.xlsx`, `.csv`) et Word (`.doc`, `.docx`) avec aperçu, correction des catégories/périodes/montants, détection des doublons et confirmation avant enregistrement.
- Liste d’incidents recherchable et filtrable, fiche de saisie reprenant les rubriques du document officiel fourni et enregistrement dans Supabase lorsqu’un compte est connecté.
- Export Word d’une fiche d’incident en renseignant le modèle officiel `public/templates/FICHE-D-INCIDENT.docx`.
- Prévisualisation de rapports avec indicateurs, répartitions détaillées, points de vigilance, tableaux de données et périodes journalier/hebdomadaire/mensuel/trimestriel/semestriel/annuel/personnalisée ; export PDF, DOCX, XLSX, PPTX, PNG ou JPG.
- Données d’exemple pour visualiser les modules et rapports en mode local.

Les semaines sont calculées du lundi au dimanche (ISO), les trimestres suivent l’année civile et les semestres sont janvier–juin et juillet–décembre. Ces conventions sont des valeurs initiales à confirmer avec l’AGETIP.

## État et architecture cible

L’application prend en charge Supabase Auth et le stockage partagé après application des migrations requises. L’historique des rapports et les notifications lues sont associés au compte. En mode non configuré, les incidents et modifications restent locaux ou utilisent l’API de développement. L’import est une aide à la saisie, pas une validation comptable : chaque aperçu doit être vérifié avant confirmation. Les champs Word peuvent être incomplets si le document stocke le montant dans un objet Excel incorporé ; le montant reste alors à compléter manuellement.

Pour la mise en production, conserver le frontend React/TypeScript et ajouter :

1. **Durcissement du backend TypeScript** avec authentification, autorisations par module, journal d’audit et endpoints versionnés avant un déploiement public.
2. **PostgreSQL** comme référentiel partagé pour incidents, équipements, maintenances, factures, mouvements de stock et historique des rapports. Relier incidents et maintenances aux équipements par identifiants stables.
3. **Service de fichiers privé** : le bucket Supabase est créé par la migration; définir les règles opérationnelles de conservation et de sauvegarde.
4. **Service documentaire local** : l’extraction de texte et la recherche par mots-clés sont raccordées au modèle Ollama local. Une indexation vectorielle et des citations par page/section peuvent améliorer la qualité des réponses.
5. **Services d’export/import côté serveur** pour les documents volumineux ou les traitements Office nécessitant une mise en page contrôlée. Comparer chaque import de factures aux règles et résultats du classeur de référence avant validation et connecter les imports au stockage partagé.

Les logiciels de cette architecture peuvent être open source et le modèle peut fonctionner localement ; le matériel, l’électricité, le stockage, l’exploitation et la maintenance restent des coûts à prévoir. Les modules actuels sont un socle d’interface, pas une déclaration de conformité ou de sécurité de production.

## Supabase et assistant IA local

Un guide de raccordement pas à pas, un schéma PostgreSQL/RLS initial et les migrations se trouvent dans [docs/SUPABASE-ET-IA-LOCALE.md](./docs/SUPABASE-ET-IA-LOCALE.md) et `supabase/migrations/`. L’application peut se connecter à Supabase Auth et à un serveur Ollama local une fois ces services configurés.
