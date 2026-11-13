# Dépannage

[← Documentation](../README.md#documentation)

## Les jeux

| Problème | Que faire |
|---|---|
| Aucun jeu n'apparaît | Vérifie *Dossier des jeux* et *Exécutable à lancer* : le nom doit être **exactement** celui du programme, dans chaque dossier de jeu. Clique **Actualiser la bibliothèque**. |
| Un seul jeu manque | Son programme porte peut-être un autre nom : tous les jeux natifs doivent avoir le même (voir [Jeux natifs](jeux-natifs.md)). |
| Un jeu émulé n'apparaît pas | L'émulateur **ou** le fichier du jeu n'est plus à l'endroit indiqué. Corrige les chemins. |
| Des tuiles grisées « Cartouche vide » | Ce sont des exclusivités non installées. Décoche **Afficher les exclusivités non installées** dans *Bibliothèque*. |
| La tuile n'a pas d'image | Voir [Titres et images](jeux-natifs.md#titres-et-images). |

## Les émulateurs

| Problème | Que faire |
|---|---|
| Le jeu s'ouvre sans plein écran | Ajoute l'option de plein écran de l'émulateur dans les arguments (voir sa documentation). |
| Une question de l'émulateur reste affichée | Règle `dialogPattern` pour qu'il corresponde au texte de la question ([Émulateurs](emulateurs.md#régler-la-détection-pour-un-émulateur-précis)). |
| L'écran noir ne part pas | Règle `readyTitle`, ou `readyLog` + `readyPattern`. Il se retire de toute façon au bout de quelques dizaines de secondes. |
| L'écran noir part trop tôt | Augmente `settleMs`, ou utilise `readyLog` + `readyPattern`. |
| L'émulateur ne démarre pas | Lance-le à la main avec les mêmes arguments dans une fenêtre de commandes : c'est la meilleure façon de trouver la bonne option. |
| L'émulateur se ferme tout seul au chargement | Regarde son journal : si tu vois des erreurs graves du rendu, essaie un autre moteur graphique dans ses réglages (Vulkan plutôt qu'OpenGL), surtout sur une carte Intel. Teste d'abord l'émulateur **à la main** : si ça plante sans le lanceur, le lanceur n'y est pour rien. |
| « Chargement » dure longtemps puis le lanceur se retire | Le titre de la fenêtre n'est pas reconnu : règle `readyTitle` ([Émulateurs](emulateurs.md#régler-la-détection-pour-un-émulateur-précis)). |
| Un jeu natif se ferme aussitôt | Retire les arguments : le programme ne connaît peut-être pas l'option donnée. |

## L'application

| Problème | Que faire |
|---|---|
| Le menu est trop clair / trop sombre | *Paramètres → Thèmes*. |
| Plus de son | *Paramètres → Son* : volumes et « Couper tous les sons ». |
| La manette ne répond pas | Appuie sur un bouton pour la réveiller. Si A et B sont inversés, active *Paramètres → Manettes → Valider avec le bouton de droite*. |
| Je veux quitter un jeu qui ne répond pas | `Ctrl+Alt+Q` ferme le jeu et ramène au menu. Sur manette : maintiens `Retour` et `Menu` ensemble 2 secondes. |
| Le lanceur démarre avec la session alors que je ne le veux pas | Décoche *Écran → Lancer au démarrage de la session*. |
| Un réglage est cassé | Ferme le lanceur, renomme `config.json` : au prochain démarrage, les valeurs par défaut reviennent. |
| Le lanceur a dit que `config.json` était illisible | Rien n'est perdu : le fichier abîmé est gardé à côté (`config.json.casse-…`) et la dernière copie de secours (`config.json.bak`) est reprise si elle est valide. Le journal `launcher.log` le précise. |
| Mes réglages sont revenus à zéro après avoir modifié `config.json` à la main | Le fichier doit rester du JSON valide (une virgule oubliée suffit à le rendre illisible : dans ce cas, voir la ligne précédente). Ferme le **lanceur** avant de le modifier, sinon il réécrit ses réglages à sa fermeture. Le caractère invisible (BOM) ajouté par certains éditeurs est maintenant accepté. |

## Le journal

Le fichier `launcher.log`, dans le dossier de données du lanceur, indique ce qui s'est passé : analyse de la bibliothèque, lancements, détection des émulateurs, erreurs. Joins-le (sans informations personnelles) quand tu ouvres un ticket.

## Signaler un bug

Ouvre un ticket sur GitHub avec :

1. ta version de Windows ;
2. ce que tu as fait et ce qui s'est passé ;
3. l'extrait utile de `launcher.log`.
