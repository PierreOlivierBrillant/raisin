# Raisin – Guide d’utilisation rapide

Raisin vous permet de :

1. Définir un modèle (structure de dossiers/fichiers attendue)
2. Analyser une archive ZIP contenant des remises d'étudiants
3. Voir un score de correspondance par projet
4. Ajuster les chemins proposés
5. Générer une archive ZIP « standardisée »

Pour un guide détaillé utilisateur : voir `README.user.md` (version longue avec FAQ et exemples).

---

## Parcours en 4 étapes

1. Construire le modèle (Étape "Modèle")
2. Importer le ZIP (Étape "ZIP")
3. Lancer l’analyse (Étape "Paramètres")
4. Examiner les résultats (Étape "Résultats")

### Aperçu visuel

| Étape         | Capture                                                  |
| ------------- | -------------------------------------------------------- |
| 1. Modèle     | ![Éditeur du modèle](docs/screenshots/modele.png)        |
| 2. Import ZIP | ![Import du ZIP](docs/screenshots/import-zip.png)        |
| 3. Paramètres | ![Paramètres d'analyse](docs/screenshots/parametres.png) |
| 4. Résultats  | ![Résultats et scores](docs/screenshots/resultats.png)   |

---

## Comprendre les scores

| Couleur | Signification                 |
| ------- | ----------------------------- |
| Vert    | ≥ 95% : quasi conforme        |
| Orange  | 90–94% : divergences mineures |
| Rouge   | < 90% : structure incomplète  |

---

## Astuces rapides

| Besoin                        | Action                               |
| ----------------------------- | ------------------------------------ |
| Sauvegarder un modèle         | Export YAML                          |
| Repartir d’un modèle existant | Import YAML                          |
| Améliorer un score faible     | Vérifier dossiers/fichiers manquants |
| Normaliser un nom de projet   | Modifier le chemin avant génération  |

---

## Fichier généré

Le fichier produit porte le nom par défaut `standardized.zip` et contient les dossiers renommés selon le modèle.

---

## Commandeur (desktop)

La version desktop inclut un espace **Commandeur** qui accompagne désormais le parcours suivant :

1. Préparer un workspace à partir d'un dossier ou d'une archive ZIP locale.
2. Importer un workflow YAML, obtenir les messages de validation et corriger les avertissements éventuels.
3. Exécuter le workflow avec suivi des logs, avertissements et erreurs consolidés.

Les opérations sont orchestrées via l'API Tauri pour accéder au système de fichiers local en respectant l'allowlist de sécurité.

---

Bon usage de Raisin 🍇
