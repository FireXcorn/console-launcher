# Contribuer

[← Documentation](README.md#documentation)

Merci de t'intéresser au projet ! Voici de quoi démarrer.

## Mettre en place

```bash
git clone https://github.com/FireXcorn/console-launcher.git
cd console-launcher
npm install
npm run dev
```

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'application en mode développement |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm test` | Lance les tests (Vitest) |
| `npm run build` | Compile l'application |
| `npm run dist` | Compile et produit `dist/win-unpacked/` |

## Organisation du code

```
src/
├─ main/        Processus principal Electron : fenêtre, réglages, bibliothèque, lancement des jeux,
│               émulateurs, thèmes, album, actualités, audio
├─ preload/     Pont sécurisé entre l'interface et le processus principal
├─ renderer/    Interface React : accueil, écrans, composants, entrées clavier / manette
└─ shared/      Types et fonctions communes (thèmes, temps de jeu…)
```

- Les réglages sont lus et normalisés dans `src/main/config.ts`.
- Le lancement des jeux et la surveillance des émulateurs sont dans `src/main/launcher.ts` et `src/main/library.ts`.
- Les thèmes : `src/shared/theme.ts` (format et valeurs sûres), `src/main/themes.ts` (dossiers), `src/renderer/src/theme.ts` (application à la page).
- Toute la mise en page utilise l'unité `--u` (1 % de la largeur d'un cadre 16:9) pour garder les mêmes proportions à toutes les résolutions.

## Avant de proposer une modification

1. `npm run typecheck` et `npm test` passent.
2. Une modification de comportement vient avec un test quand c'est possible (les tests sont à côté du code, `*.test.ts`).
3. Tout ce qui vient d'un fichier ou de l'interface (chemins, noms, thèmes importés) est **vérifié** avant d'être utilisé : pas de chemin libre, pas de sortie du dossier prévu.
4. Pas d'images, de logos, de sons ou de personnages protégés dans le dépôt. N'ajoute que des ressources dont tu as les droits, ou libres de droits.

## Publier

Pour mettre le projet en ligne ou publier une version téléchargeable : [Publier sur GitHub](docs/publier-sur-github.md).

## Signaler un problème ou proposer une idée

Ouvre un ticket en décrivant ce que tu attends et ce qui se passe. Voir aussi [Dépannage](docs/depannage.md).
