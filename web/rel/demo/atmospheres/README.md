# Atmosphères — architectures et environnements reproductibles

La scène `demo/loop_house/loop-house.scene` reste la référence, sans modification.
Les variantes sont des documents Cinematic ordinaires : `initial + seq`, géométrie
nommée, matériaux partagés, lumières, scatter, contrôles et graines stables.

Trois premiers choix :

| Scène | Architecture | Environnement | Graine |
| --- | --- | --- | --- |
| refuge-moonlit-137.scene | Refuge en bois et ardoise | Mare, roseaux, forêt lunaire | 137 |
| keeper-amber-283.scene | Maison en pierre et tour de gardien | Feuilles d’automne, crépuscule | 283 |
| mill-dawn-619.scene | Moulin à ailes et logement attenant | Prairie fleurie, bouleaux, aube | 619 |

## Générer une autre variation

Depuis meshopt, avec le Python disponible :

```powershell
python tools/generate_atmospheres.py --seed 904 --architecture keeper --biome moonlit --output D:/dev/mes-scenes/gardien-904.scene
```

Architectures : `refuge`, `keeper`, `mill`. Biomes : `moonlit`, `amber`, `dawn`.
Omettre les deux choix les tire au sort à partir de la graine. Graine entière
0..16777215. Le générateur refuse d’écraser un fichier. Les dimensions, placement
des arbres, chemin, variations de tuiles et matériaux sont reproductibles.
La recette est conservée dans le champ `generator` du document généré. Un export
du moteur sauvegarde son propre document attaché ; la fiche Atelier garde sa graine.

Les fondations et la mare réservent leur espace, les troncs évitent le passage
et leurs voisins. La première dalle suit l’entrée ; les suivantes suivent la
même courbe en S que l’exclusion d’herbe. Les ouvertures des murs sont découpées,
avec leur fond opaque lumineux reculé de 12cm. Les composants ramifiés des arbres
de référence sont replantés et redimensionnés ; les positions originales ne sont
pas réutilisées. Une géométrie développée reste modifiable par les outils normaux.

## MCP et réglages

Le générateur est actuellement un outil Python de création de documents, pas un
nouveau type du handler natif `scene.apply generate`. Charger le JSON produit via
`scene.cinematic`, `command:load_document`, `document:…`, `start_paused:true`, dans
une session de test isolée ; ou ouvrir son `.scene` normalement.

**Scene settings → Atmospheres** contient Souffle du vent, Brume au sol, Force des
rayons, Hauteur de l’herbe, Halo lumineux et Flare optique. Les mêmes bindings sont
accessibles via `scene.controls set` avec `live:true`. La brume globale se règle
aussi dans Sky → mist, et la lune dans Lumières → Moon. Les réglages sont sauvés
par la persistance normale du moteur.

## Boucles et budget

Cycle commun de 15 secondes, orbite d’un tour et poussée périodique ; la caméra
initiale correspond exactement à la formule à t=0. Les ailes font un tour linéaire.
Le vent et les particules ont des cycles entiers. Nuages statiques, scintillement
des étoiles désactivé, aucun corps physique libre ni audio aléatoire. La version 2 ajoute un allumage progressif, une porte articulée avec son
grinçement enregistré et deux oiseaux aux trajectoires déterministes. Les clips
initiaux silencieux restent disponibles pour comparaison. Export loop, filigrane continu, aucun outro.

Les scènes utilisent moins de 450 objets, 48 émetteurs, 24 000 cartes et 9 lumières.
Pas de nouvelle passe de rendu : cartes de brume, bloom/flare existants, rayons
24 échantillons en preview et 32 à l’export. C’est un rendu procédural stylisé avec
des matériaux réalistes ; la brume en cartes et les reflets restent approximatifs.

Validation : `python tools/test_atmospheres.py` couvre 81 recettes, déterminisme,
placements et fermeture de caméra. Les trois clips natifs sont inspectés en pixels,
puis `tools/check_loop_video.py` mesure leur raccord et vérifie avec `--with-audio` une piste audible et un raccord audio calme.
La différence dernier/premier doit rester comparable aux pas voisins : la dernière
image stockée est à 14,9667s. Cette mesure complète les contraintes de fermeture,
elle ne garantit pas une boucle après des modifications utilisateur arbitraires.

Résultats : https://polynite.io/atelier/?collection=atmospheres

## Version 2 — vie et sécurité du moulin

Les fenêtres s’allument progressivement, la porte ouvre à 3,35s et se referme
avant 6,9s. Seul son fond opaque lumineux est visible. Un bref son accompagne
l’allumage ; les oiseaux chantent à des instants fixes. Aucun audio aléatoire ni
écho ne traverse le raccord : les premières et dernières 0,5s restent silencieuses.
Le niveau final et la douceur des sons restent à apprécier à l’écoute.

Les oiseaux suivent des splines Hermite cycliques et battent des ailes 24 fois
par boucle. `initial.anims[].repeat` accepte un entier 1..64. `ease:spline` exige
un canal position, au moins trois clés strictement ordonnées dans [0,période),
toutes spline. Ces scènes nécessitent le moteur d’animation version 2 ; elles
ne fonctionnent pas intégralement avec un ancien binaire web. Le contrôle
**Oiseaux visibles** se trouve dans Scene settings → Atmospheres.

Le moulin réserve le disque complet des ailes et leur épaisseur, avec 12cm de
marge, puis écarte les arbres en tenant compte de leur couronne et du vent.
`tools/scene_loop_safety.py` refuse une scène qui intersecte ce volume. Le moyeu
et son axe sont les seules exceptions intentionnelles. Ce contrôle statique
conservateur complète les réservations de sol ; ce n’est pas un solveur physique.

`scene.describe.loop_animation` décrit les limites, la fermeture des poses et
la continuité de vitesse au raccord du cycle de base. Cet audit exclut caméra,
lumières, sons et collisions ; les vidéos exportées doivent aussi être vérifiées.
Les modifications passent par le même `scene.apply` atomique et la sérialisation
normale. Les paramètres incorrects sont refusés sans modifier les autres réglages.

Validation native du 14 octobre : 81 recettes valides, dix rejets MCP atomiques,
trois films 450 images, raccord image comparable aux pas voisins et audio nul
aux extrémités. Le compilateur shader vmesh.glsl rencontre un plantage préexistant
(exit 3221225725). Le test natif utilise le dernier en-tête shader valide avec
le nouveau module CPU compilé ; aucun nouveau binaire WebGPU n’est publié.

Régression MCP reproductible : `python tools/test_loop_animation_contract.py`,
uniquement dans un viewer de test isolé avec une variante Atmospheres ouverte.
Le script refuse un export actif et restaure le document de test à la fin.
