# AGETIP — Informatique & technique

Interface React/TypeScript responsive inspirée des captures fournies. L’application réunit un tableau de bord, les modules opérationnels, les rapports, un espace documentaire et l’assistant AGETIP.

## Démarrer

```sh
npm install
npm run dev
```

`npm run build` vérifie les types TypeScript puis génère le site dans `dist/`.

## Fonctionnalités de cette première version

- Navigation responsive et tableau de bord avec accès direct aux incidents, équipements et maintenances.
- Ajout et modification des factures SONATEL, articles et mouvements de cartouches, équipements informatiques, climatiseurs et maintenances ; modifications enregistrées dans le navigateur et reprises dans le tableau de bord et les rapports.
- Liste d’incidents recherchable et filtrable, fiche de saisie reprenant les rubriques du document officiel fourni et enregistrement local dans le navigateur.
- Export Word d’une fiche d’incident en renseignant le modèle officiel `public/templates/FICHE-D-INCIDENT.docx`.
- Prévisualisation de rapports avec indicateurs, répartitions détaillées, points de vigilance, tableaux de données et périodes journalier/hebdomadaire/mensuel/trimestriel/semestriel/annuel/personnalisée ; export PDF, DOCX, XLSX, PPTX, PNG ou JPG.
- Données d’exemple pour visualiser les modules, l’assistant et les rapports avant leur raccordement à un serveur.

Les semaines sont calculées du lundi au dimanche (ISO), les trimestres suivent l’année civile et les semestres sont janvier–juin et juillet–décembre. Ces conventions sont des valeurs initiales à confirmer avec l’AGETIP.

## État et architecture cible

Cette version est un prototype frontend : les incidents et les modifications des modules sont enregistrés dans le `localStorage` du navigateur, et les enregistrements initiaux restent des données d’exemple. Ces données ne sont pas partagées entre utilisateurs et ne sont pas encore synchronisées avec Supabase. Il n’y a pas encore de comptes, de rôles effectifs, de backend, de base partagée, d’import Excel validé ni d’indexation RAG. Les documents ajoutés à l’écran ne sont pas envoyés à un service d’IA. Ne pas utiliser ce prototype pour des données opérationnelles ou confidentielles.

Pour la mise en production, conserver le frontend React/TypeScript et ajouter :

1. **API backend TypeScript** avec authentification, autorisations par module, validation des entrées, journal d’audit et endpoints versionnés.
2. **PostgreSQL** comme référentiel partagé pour incidents, équipements, maintenances, factures, mouvements de stock et historique des rapports. Relier incidents et maintenances aux équipements par identifiants stables.
3. **Service de fichiers privé** pour les imports et documents de référence, avec prévisualisation, contrôles, confirmation des modifications et règles de conservation.
4. **Service documentaire local** : extraction et indexation des fichiers autorisés, recherche RAG, réponses en français avec références, puis modèle servi par Ollama. Les requêtes opérationnelles passent par l’API et appliquent les mêmes droits que l’interface.
5. **Services d’export/import côté serveur** pour les documents volumineux ou les traitements Office nécessitant une mise en page contrôlée. Comparer chaque import de factures aux règles et résultats du classeur de référence avant validation.

Les logiciels de cette architecture peuvent être open source et le modèle peut fonctionner localement ; le matériel, l’électricité, le stockage, l’exploitation et la maintenance restent des coûts à prévoir. Les modules actuels sont un socle d’interface, pas une déclaration de conformité ou de sécurité de production.

## Supabase et assistant IA local

Un guide de raccordement pas à pas, un schéma PostgreSQL/RLS initial, la configuration des rôles et l’architecture Ollama + RAG sont décrits dans [docs/SUPABASE-ET-IA-LOCALE.md](./docs/SUPABASE-ET-IA-LOCALE.md). La migration SQL se trouve dans `supabase/migrations/`. Ces éléments préparent l’intégration ; ils ne signifient pas que le prototype est déjà connecté à Supabase ou à un modèle IA.
