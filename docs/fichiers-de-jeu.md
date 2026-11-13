# Jeux, émulateurs, outils : ce qui est inclus (et ce qui ne l'est pas)

[← Documentation](../README.md#documentation)

## En bref

Console Launcher est **uniquement un menu**. Il lance ce que **tu** as installé. Il ne contient, ne télécharge et ne distribue **aucun** :

- jeu (ni fichier de jeu : `.nsp`, `.nup`, `.xci`, `.iso`, `.exe` de jeu…) ;
- émulateur ;
- outil de recompilation ou de portage ;
- clé de chiffrement, firmware, BIOS ou autre fichier propre à une console ;
- image, son, logo ou personnage protégé.

Ce dépôt ne peut pas les contenir : les distribuer est contraire au droit d'auteur, et ce n'est pas le but du projet.

## « Intégrés » : ce que ça veut dire ici

Le lanceur **s'intègre** à ces outils : il sait les démarrer avec le bon fichier, masquer leur fenêtre pendant le chargement, répondre à leurs questions habituelles, puis donner à la fenêtre du jeu son titre et sa jaquette. **L'outil lui-même, tu l'installes toi-même**, depuis son site officiel.

| Type de jeu | Ce que fournit le lanceur | Ce que tu fournis |
|---|---|---|
| Jeu PC natif | Une tuile, le lancement, le temps de jeu | Le dossier du jeu |
| Jeu sur émulateur | Une tuile, le lancement de l'émulateur avec ton jeu | L'émulateur et le fichier du jeu |
| Jeu issu d'une recompilation / d'un portage | Une tuile, comme un jeu natif | Le programme obtenu avec l'outil, à partir de **ta** copie du jeu |

Comment faire, pas à pas : [Intégrer toi-même un émulateur ou un outil de recompilation](integrer-un-outil.md).

## Où trouver mes fichiers ?

Uniquement à partir de ce que tu possèdes :

- **Fichiers de jeu** : extraits toi-même de tes propres jeux, avec ton propre matériel.
- **Clés et firmware** (si ton émulateur en demande) : extraits de ta propre console, avec les outils prévus pour cela.
- **Outils de recompilation** : utilise-les sur **ta** copie du jeu, en suivant la documentation de leurs auteurs. Le résultat (un programme PC) est pour ton usage personnel.

Ne demande pas, dans les tickets ou les discussions du projet, où télécharger des jeux, des clés ou des firmwares : ces messages seront fermés sans réponse.

## Ajouter ensuite le jeu au lanceur

1. **Jeu PC, ou issu d'une recompilation** : [Jeux natifs](jeux-natifs.md).
2. **Jeu sur émulateur** : [Émulateurs](emulateurs.md).
3. **Jaquette, titre, icône** : [Personnalisation](personnalisation.md).

## Marques

Les noms de jeux, de consoles et d'émulateurs cités appartiennent à leurs propriétaires. Console Launcher n'est ni affilié ni approuvé par eux.
