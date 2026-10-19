# Raccordement de Supabase et activation de l’IA locale

## État actuel

L’application est encore un prototype : les incidents sont conservés dans le navigateur et les autres modules affichent des exemples. Elle ne lit ni n’écrit encore dans Supabase. Le dépôt contient une première migration SQL pour préparer la base et ses droits ; il ne remplace pas le raccordement de l’interface et du backend.

## 1. Préparer Supabase

1. Créer un projet Supabase dans l’organisation AGETIP et choisir une région conforme aux exigences internes de résidence des données.
2. Dans **Project Settings → API**, relever l’URL du projet et la clé **publishable** (ou `anon` sur les anciens projets). Ces valeurs identifient le projet ; elles ne remplacent pas les règles d’accès.
3. Appliquer `supabase/migrations/202610190001_initial_schema.sql` avec Supabase CLI (`supabase db push`) ou dans le SQL Editor, après revue par l’administrateur de base de données.
4. Dans **Authentication**, désactiver l’inscription publique et inviter les comptes autorisés. Le trigger crée leur profil avec le rôle restreint `reader`.
5. Attribuer les rôles après création des comptes, depuis le SQL Editor en remplaçant les adresses :

   ```sql
   update public.user_profiles
   set role = 'admin', display_name = 'Administrateur AGETIP'
   where id = (select id from auth.users where email = 'admin@agetip.sn');

   -- Rôles disponibles : admin, technician, finance, reader
   ```

   L’attribution de `admin` doit être réservée à une personne habilitée. Les factures SONATEL sont limitées aux rôles `finance` et `admin` par les politiques RLS.
6. Dans le dépôt, installer le client avec `npm install @supabase/supabase-js`. Copier l’URL et la clé **publishable** (ou `anon`) de **Project Settings → API** dans un fichier `.env.local` à la racine :

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable-key>
   ```

   Vite expose les variables `VITE_*` au navigateur : elles ne doivent contenir que l’URL et la clé publique. Ajouter `.env.local` à `.gitignore` avant de le remplir, redémarrer `npm run dev`, puis utiliser un client dédié. Exemple pour la future intégration :

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
7. Remplacer le stockage local progressivement, module par module : incidents → équipements/climatiseurs → maintenances → stock et mouvements → factures SONATEL. Ajouter l’état de chargement, la gestion d’erreur, les conflits d’édition et un retour utilisateur. Avant la migration des données, exporter une copie des données locales, valider les colonnes et doublons, afficher un aperçu et demander confirmation. Les données d’exemple ne doivent jamais être fusionnées silencieusement avec les données réelles.
8. Tester les politiques RLS avec un compte pour chaque rôle. Vérifier lecture, création, mise à jour et suppression de chaque table, y compris l’accès des lecteurs aux factures et aux fichiers. Les politiques RLS constituent le contrôle d’accès de la base ; masquer un bouton dans React ne suffit pas.

Le service Database/Auth/API de Supabase peut être utilisé comme backend de données pour l’application sans serveur Node supplémentaire. Un serveur API interne reste nécessaire pour les traitements qui ne doivent pas s’exécuter dans le navigateur — notamment Ollama/RAG, l’extraction de documents, l’import sensible et les clés privilégiées. Il doit vérifier le jeton Supabase de l’utilisateur et appliquer les rôles avant chaque opération. Le prototype React actuel n’exécute pas encore ces étapes : sans les paramètres, l’authentification et l’adaptateur de stockage, les écrans restent locaux.

**Ne jamais placer une clé `service_role` ou `secret` dans le navigateur, dans le dépôt ou dans un document partagé.** Elle contourne les politiques RLS. Si une opération nécessite des privilèges élevés, elle doit être exécutée dans un backend de confiance et contrôlée côté serveur. Ne transmettez pas de clés secrètes dans le chat.

Les imports Excel doivent rester une étape distincte : aperçu des lignes, validation des colonnes, détection de doublons, comparaison des valeurs calculées, puis confirmation explicite avant écriture. Le schéma ne synchronise pas automatiquement un classeur.

### Appliquer la migration

La migration n’est pas appliquée à un projet distant tant que l’AGETIP ne l’a pas revue. Avec Supabase CLI déjà installée et un projet sélectionné :

```powershell
npx supabase init
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`supabase init` crée la configuration locale s’il n’y en a pas encore. `db push` modifie la base distante : revoir la migration, confirmer le bon projet et disposer d’une sauvegarde avant son exécution. Il est aussi possible de coller le contenu du fichier SQL dans le SQL Editor du projet. Les migrations ultérieures doivent être versionnées et appliquées dans l’ordre.

## 2. Modèle de données de départ

La migration sépare les profils et rôles, les équipements, les incidents, les factures SONATEL, les articles et mouvements de stock, les interventions de maintenance et les métadonnées des documents. Les références d’équipement des incidents et des maintenances peuvent pointer vers un enregistrement stable de `equipment`. Une extension future pourra ajouter les climatiseurs comme catégorie d’équipement ou comme module dédié sans changer l’identité des incidents.

Le schéma est une base initiale, pas une migration de production déjà appliquée. Il faut le valider avec l’AGETIP, ajouter au besoin des champs métier requis, définir la conservation et prévoir sauvegardes et tests de restauration avant toute donnée réelle.

La migration ne crée pas encore de bucket Supabase Storage ni de politiques d’accès par document : la lecture des métadonnées `reference_documents` est actuellement autorisée à tous les utilisateurs authentifiés. Ne pas y déposer de documents confidentiels avant d’avoir défini un bucket privé et des politiques Storage qui vérifient les droits du document. Le RAG doit conserver les mêmes droits dans les métadonnées et filtrer les résultats avant de les envoyer au modèle.

## 3. Activer une IA locale avec Ollama et RAG

1. Installer Ollama sur un poste de test contrôlé par l’AGETIP (installateur officiel Windows/macOS/Linux) ou sur un serveur interne. Après installation, vérifier son fonctionnement local, puis choisir un modèle de génération et un modèle d’embeddings adaptés au matériel. Exemples à évaluer dans PowerShell :

   ```powershell
   ollama pull qwen2.5:7b
   ollama pull nomic-embed-text
   ollama run qwen2.5:7b
   ```

   Ces commandes installent et testent le moteur, mais ne connectent pas encore l’assistant de l’application.
2. Avant tout usage institutionnel, vérifier la licence du tag exact du modèle et de ses dépendances, la capacité de la machine et les règles de sécurité. La disponibilité des poids ne garantit pas automatiquement que tout usage est autorisé.
3. Créer un backend interne (par exemple FastAPI ou Node.js) avec une route authentifiée telle que `POST /api/assistant/query`. Le frontend envoie la question et son jeton de session Supabase ; le serveur valide le jeton, contrôle les rôles, recherche uniquement dans les sources accessibles à l’utilisateur et appelle Ollama sur le réseau privé. Ne pas appeler directement Ollama depuis le navigateur : une page web ouverte sur le poste d’un utilisateur ne peut ni garantir les autorisations ni accéder au `localhost` du serveur.
4. Mettre les documents approuvés dans un espace documentaire privé. Un flux d’alimentation fiable est : dépôt autorisé → antivirus/type/taille contrôlés → extraction PDF/DOCX (OCR explicite pour les scans) → découpage en passages conservant `document_id`, nom, page/section, version et droits → calcul d’embeddings → indexation. On peut utiliser Qdrant ou un PostgreSQL local avec pgvector ; les contenus confidentiels et les vecteurs doivent rester dans l’environnement approuvé par l’AGETIP.
5. À chaque remplacement ou retrait d’un document, recalculer l’index et retirer les passages précédents. Pour répondre, rechercher les passages pertinents autorisés, transmettre à Ollama seulement la question et ces passages, demander une réponse française concise avec références (document + page/section), et afficher les références dans l’interface. Si les passages ne suffisent pas, le modèle doit l’indiquer plutôt que d’inventer. Les documents ne sont pas à « entraîner » dans le modèle : leur indexation RAG peut être renouvelée sans réentraînement.
6. Pour les questions opérationnelles, extraire les enregistrements via Supabase/API avec le contexte d’identité de la personne connectée ; appliquer les mêmes droits aux données et aux résultats générés. Ne jamais mettre les clés Supabase privilégiées dans le navigateur ni donner au modèle un accès SQL direct.

Contrat minimal recommandé pour la route d’assistant :

```json
{
  "question": "Quelle procédure appliquer pour un incident réseau critique ?"
}
```

L’identité et les rôles proviennent du jeton vérifié côté serveur, jamais d’un `userId` fourni dans le JSON. La réponse devrait contenir `answer` et une liste `sources` avec au minimum `title`, `page` ou `section`, et `documentVersion`. Le backend retourne une erreur HTTP explicite si l’utilisateur n’est pas authentifié, si aucune source autorisée ne répond ou si Ollama est indisponible. Cela permet à React d’afficher les références et un état d’erreur au lieu d’une réponse inventée.

Pour alimenter la base documentaire, commencer par un petit lot de procédures approuvées par l’AGETIP : déposer les fichiers dans l’espace privé, indexer PDF/DOCX, vérifier l’extraction et les pages, puis poser des questions dont les réponses sont connues et vérifier chaque citation. Ensuite seulement, autoriser les mises à jour documentaires ; chaque version doit remplacer l’index précédent, et la suppression d’un document doit aussi supprimer ses vecteurs. Les fichiers scannés nécessitent un OCR dont le résultat doit être contrôlé.
6. Protéger les fichiers originaux, l’index vectoriel, les journaux et les sauvegardes avec des droits minimaux, chiffrement et règles de conservation. Ne pas exposer Ollama à Internet ni transmettre de documents confidentiels à un service externe sans autorisation explicite.

Le logiciel Ollama et les modèles à poids ouverts peuvent être utilisés sans abonnement par requête ; le serveur, la mémoire/GPU, l’électricité, l’exploitation, les sauvegardes et l’administration ont néanmoins un coût.

L’assistant présent dans le prototype répond actuellement par un message de démonstration : il ne traite ni documents ni données Supabase. Il sera réellement activé après la création du service API, de la chaîne d’indexation et de l’authentification, puis le remplacement de cette réponse de démonstration par un appel à l’API.

## 4. Configuration réseau

Pour le développement sur un seul poste, le backend peut joindre Ollama localement. En production, héberger les deux services sur le réseau interne et filtrer les ports par pare-feu. Si le frontend et Ollama ne résident pas sur le même ordinateur, `localhost` dans le navigateur désigne le poste de l’utilisateur, pas le serveur : le navigateur doit donc communiquer avec l’API backend de l’AGETIP, pas avec l’adresse locale d’Ollama.
