# Raccordement de Supabase et activation de l’IA locale

## État actuel

L’application utilise Supabase Auth et `public.app_records` pour les données métier, les préférences de notifications, l’historique des rapports et les conversations. Les documents sont enregistrés dans un bucket Supabase privé après application de la migration `202610280002_workspace_features.sql`. L’assistant appelle Ollama via le backend local et recherche dans le texte extrait des documents indexés. Ces intégrations ne dispensent pas des tests de rôles, de sauvegarde et de déploiement décrits ci-dessous.

## 1. Préparer Supabase

1. Créer un projet Supabase dans l’organisation AGETIP et choisir une région conforme aux exigences internes de résidence des données.
2. Dans **Project Settings → API**, relever l’URL du projet et la clé **publishable** (ou `anon` sur les anciens projets). Ces valeurs identifient le projet ; elles ne remplacent pas les règles d’accès.
3. Le schéma initial et `202610280001_app_records.sql` sont déjà appliqués sur le projet de développement. Appliquer `supabase/migrations/202610280002_workspace_features.sql` dans le SQL Editor pour ajouter les droits personnels, le bucket privé et ses politiques.
4. Dans **Authentication**, désactiver l’inscription publique et inviter les comptes autorisés. Le trigger crée leur profil avec le rôle restreint `reader`.
5. Attribuer les rôles après création des comptes, depuis le SQL Editor en remplaçant les adresses :

   ```sql
   update public.user_profiles
   set role = 'admin', display_name = 'Administrateur AGETIP'
   where id = (select id from auth.users where email = 'admin@agetip.sn');

   -- Rôles disponibles : admin, technician, finance, reader
   ```

   L’attribution de `admin` doit être réservée à une personne habilitée. Les factures SONATEL sont limitées aux rôles `finance` et `admin` par les politiques RLS.
6. Dans `.env.local`, configurer l’URL et la clé publishable/anon de **Project Settings → API** :

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

   Vite expose les variables `VITE_*` au navigateur : elles ne doivent contenir que l’URL et la clé publique. `.env.local` doit rester ignoré par Git. Le client et l’authentification Supabase sont déjà raccordés dans l’application.

   ```ts
   // src/lib/supabase.ts
   import { createClient } from '@supabase/supabase-js'

   const url = import.meta.env.VITE_SUPABASE_URL
   const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

   if (!url || !publishableKey) {
     throw new Error('Configuration Supabase manquante : renseignez .env.local.')
   }

   export const supabase = createClient(url, publishableKey, {
     auth: { persistSession: true, autoRefreshToken: true },
   })
   ```

   Après avoir créé un compte autorisé dans Supabase Auth, les opérations passent par le client connecté ; par exemple :

   ```ts
   const { data, error } = await supabase
     .from('incidents')
     .select('*')
     .order('reported_at', { ascending: false })

   if (error) throw error
   ```

   La requête doit être faite après connexion. PostgreSQL applique les politiques RLS au jeton de l’utilisateur : une erreur doit être montrée à l’écran et journalisée, pas remplacée par les exemples. Pour écrire, mapper les noms camelCase de l’interface aux colonnes SQL (snake_case), valider les champs, puis appeler `insert`, `update` ou `upsert` selon la règle métier. Les erreurs réseau et d’autorisation doivent rester visibles.
7. Après connexion au compte administrateur, utiliser **Paramètres → Transférer les données locales** pour importer les enregistrements locaux absents de Supabase. Le transfert ne remplace pas les données distantes et ne supprime pas le `localStorage`. Les fichiers binaires n’étaient pas persistés localement et ne sont donc pas inclus.
8. Tester les politiques RLS avec un compte pour chaque rôle. Vérifier lecture, création, mise à jour et suppression de chaque table, y compris l’accès des lecteurs aux factures et aux fichiers. Les politiques RLS constituent le contrôle d’accès de la base ; masquer un bouton dans React ne suffit pas.

Les données de l’application passent directement par Supabase et sont contrôlées par RLS. Le backend Node sert l’assistant Ollama; il ne constitue pas encore une API métier authentifiée pour les autres opérations et ne doit pas être exposé tel quel à Internet.

**Ne jamais placer une clé `service_role` ou `secret` dans le navigateur, dans le dépôt ou dans un document partagé.** Elle contourne les politiques RLS. Si une opération nécessite des privilèges élevés, elle doit être exécutée dans un backend de confiance et contrôlée côté serveur. Ne transmettez pas de clés secrètes dans le chat.

Les imports Excel doivent rester une étape distincte : aperçu des lignes, validation des colonnes, détection de doublons, comparaison des valeurs calculées, puis confirmation explicite avant écriture. Le schéma ne synchronise pas automatiquement un classeur.

### Appliquer la migration

Pour le projet déjà configuré, appliquer uniquement les migrations qui ne l’ont pas encore été. Dans le cas présent, appliquer la migration `202610280002_workspace_features.sql` après avoir vérifié le bon projet et effectué une sauvegarde :

```powershell
npx supabase init
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`supabase init` crée la configuration locale s’il n’y en a pas encore. `db push` modifie la base distante : revoir la migration, confirmer le bon projet et disposer d’une sauvegarde avant son exécution. Il est aussi possible de coller le contenu du fichier SQL dans le SQL Editor du projet. Les migrations ultérieures doivent être versionnées et appliquées dans l’ordre.

## 2. Modèle de données de départ

Les migrations créent les profils et rôles, les données métier, les préférences personnelles et l’historique, ainsi qu’un bucket privé pour les fichiers de référence et les index texte.

Le schéma est une base initiale. Il faut le valider avec l’AGETIP, définir la conservation et prévoir des sauvegardes et tests de restauration avant les données opérationnelles.

La migration 002 crée le bucket privé `agetip-documents`. Seuls les comptes authentifiés peuvent lire les objets; l’ajout et la suppression sont réservés aux rôles administrateur et technicien. Les passages pertinents sont envoyés au serveur Ollama local configuré par le backend.

## 3. Activer une IA locale avec Ollama et RAG

1. Installer Ollama sur un poste de test contrôlé par l’AGETIP (installateur officiel Windows/macOS/Linux) ou sur un serveur interne. Après installation, vérifier son fonctionnement local, puis choisir un modèle de génération et un modèle d’embeddings adaptés au matériel. Exemples à évaluer dans PowerShell :

   ```powershell
   ollama pull qwen2.5:3b
   ```

   Le backend est configuré par défaut pour ce modèle. Modifie `OLLAMA_MODEL` dans `.env.local` si tu en choisis un autre.
2. Avant tout usage institutionnel, vérifier la licence du tag exact du modèle et de ses dépendances, la capacité de la machine et les règles de sécurité. La disponibilité des poids ne garantit pas automatiquement que tout usage est autorisé.
3. L’application appelle le backend Node (`/api/assistant/chat`), qui contacte Ollama sur le réseau local; elle ne contacte pas directement un fournisseur IA externe.
4. Les documents PDF, DOCX, DOC et TXT sont extraits dans le navigateur, puis l’original et l’index texte sont stockés dans le bucket privé. La recherche actuelle utilise un classement par mots-clés et envoie les extraits retenus au modèle. Les PDF numérisés sans texte sont stockés mais non indexés; l’OCR n’est pas intégré.
5. Les réponses affichent les noms des fichiers sources, mais pas les pages ni sections. Une indexation vectorielle, une extraction de références paginées et l’OCR restent des améliorations futures. Si aucun passage ne correspond, le modèle reçoit la consigne de signaler le manque de contexte.
6. Pour les questions opérationnelles, extraire les enregistrements via Supabase/API avec le contexte d’identité de la personne connectée ; appliquer les mêmes droits aux données et aux résultats générés. Ne jamais mettre les clés Supabase privilégiées dans le navigateur ni donner au modèle un accès SQL direct.

Contrat minimal recommandé pour la route d’assistant :

```json
{
  "question": "Quelle procédure appliquer pour un incident réseau critique ?"
}
```

L’endpoint de l’assistant vérifie le jeton Supabase auprès d’Auth lorsque les variables Supabase sont configurées et retourne explicitement les erreurs Ollama. Les autres routes CRUD de démonstration du backend ne sont pas authentifiées : ne pas exposer ce backend tel quel à Internet.

Pour alimenter la base documentaire, commencer par un petit lot de procédures approuvées par l’AGETIP : déposer les fichiers dans l’espace privé, indexer PDF/DOCX, vérifier l’extraction et les pages, puis poser des questions dont les réponses sont connues et vérifier chaque citation. Ensuite seulement, autoriser les mises à jour documentaires ; chaque version doit remplacer l’index précédent, et la suppression d’un document doit aussi supprimer ses vecteurs. Les fichiers scannés nécessitent un OCR dont le résultat doit être contrôlé.
6. Protéger les fichiers originaux, l’index vectoriel, les journaux et les sauvegardes avec des droits minimaux, chiffrement et règles de conservation. Ne pas exposer Ollama à Internet ni transmettre de documents confidentiels à un service externe sans autorisation explicite.

Le logiciel Ollama et les modèles à poids ouverts peuvent être utilisés sans abonnement par requête ; le serveur, la mémoire/GPU, l’électricité, l’exploitation, les sauvegardes et l’administration ont néanmoins un coût.

Pour démarrer le backend et le frontend en développement, lancer `npm run dev:all`. Ollama doit être installé et le modèle doit avoir été téléchargé. L’historique de l’assistant est synchronisé par compte; les extraits récupérés depuis Storage ne sont transmis qu’au backend configuré.

## 4. Configuration réseau

Pour le développement sur un seul poste, le backend peut joindre Ollama localement. En production, héberger les deux services sur le réseau interne et filtrer les ports par pare-feu. Si le frontend et Ollama ne résident pas sur le même ordinateur, `localhost` dans le navigateur désigne le poste de l’utilisateur, pas le serveur : le navigateur doit donc communiquer avec l’API backend de l’AGETIP, pas avec l’adresse locale d’Ollama.
