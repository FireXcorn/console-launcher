# Ajouter un jeu natif

[← Documentation](../README.md#documentation)

Un jeu « natif » est un programme PC (`.exe`) que le lanceur démarre directement.

## Le principe

Le lanceur analyse **un dossier** : le dossier lui-même et **chacun de ses sous-dossiers directs**. Dans chacun, il cherche **le même nom de programme** (par exemple `jeu.exe`). Quand il le trouve, le dossier devient une tuile.

```
D:\Mes jeux\                  ← « Dossier des jeux »
├─ Super Aventure\            ← tuile « Super Aventure »
│   ├─ jeu.exe
│   └─ cover.png              ← image de la tuile (facultatif)
├─ Circuit Turbo\             ← tuile « Circuit Turbo »
│   ├─ jeu.exe
│   └─ icon.jpg
└─ Puzzle Lab\
    └─ jeu.exe
```

> **Limite actuelle.** Tous les jeux natifs doivent avoir le même nom de programme. Un jeu dont le programme s'appelle autrement n'apparaît pas.

## Étapes

1. **Paramètres de la console → Bibliothèque.**
2. **Dossier des jeux** : **Parcourir…** puis choisis `D:\Mes jeux`.
3. **Exécutable à lancer** : le nom du programme, relatif au dossier du jeu. Exemples : `jeu.exe`, `bin\jeu.exe`.
4. **Arguments** (facultatif) : options données au programme. `{dir}` est remplacé par le dossier du jeu. **Laisse vide si tu n'es pas sûr** : un programme qui ne connaît pas une option peut s'arrêter aussitôt (par exemple avec « cannot open … »).
5. **Actualiser la bibliothèque**, puis reviens à l'accueil.

## Jeux issus d'une recompilation ou d'un portage

Un outil de recompilation produit un programme PC (`.exe`) à partir de **ta** copie d'un jeu. Pour le lanceur, c'est un jeu natif comme un autre : place le dossier obtenu dans ton dossier des jeux et indique le programme (souvent `bin\nom.exe`). Si le programme est dans un sous-dossier, garde le dossier du jeu comme dossier de travail : c'est ce que fait le lanceur. **Dossier rangé ailleurs, ou programme au nom différent ?** Ajoute-le comme un *jeu sur émulateur* **sans fichier de jeu** : *Programme de l'émulateur* = le `.exe` du jeu recompilé, *Fichier du jeu* laissé vide, *Arguments* vides. Si la fenêtre du jeu a un titre reconnaissable (par exemple « Mon Jeu Recomp »), indique-le dans `readyTitle` ([Émulateurs](emulateurs.md#régler-la-détection-pour-un-émulateur-précis)) pour que l'écran noir parte dès que le jeu tourne. Le lanceur ne contient aucun de ces outils ni aucun jeu : voir [ce qui est inclus et ce qui ne l'est pas](fichiers-de-jeu.md).

## Titres et images

| Quoi | Comment |
|---|---|
| **Titre** | Il vient du nom du dossier. Ce qui est entre `[ ]` et `( )` est retiré (`Super Aventure [v1.2]` → `Super Aventure`). Pour le changer : *Bibliothèque → Jeux*, champ du titre. |
| **Image** | Place dans le dossier du jeu un fichier nommé `icon`, `cover` ou `banner` (`.png`, `.jpg`, `.webp` ou `.ico`). Ou *Bibliothèque → Jeux → Image…* pour choisir un fichier. |
| **Dossier de jaquettes** | Un dossier unique d'images nommées comme le jeu (`Super Aventure.png`), choisi dans *Bibliothèque → Dossier des jaquettes*. |

## Lancer et quitter

Valide la tuile (`Entrée` / A). Un écran noir couvre le chargement, puis le jeu passe en plein écran. Quand tu fermes le jeu, tu reviens au menu et le jeu repasse en première position. Le temps de jeu est ajouté à ton profil.

## Mettre à jour la bibliothèque

- **Nouveau jeu** : copie son dossier dans le dossier des jeux, puis *Actualiser la bibliothèque*.
- **Retirer un jeu** : supprime ou déplace son dossier, puis actualise.

## Voir aussi

[Émulateurs](emulateurs.md) · [Personnalisation](personnalisation.md) · [Dépannage](depannage.md)
