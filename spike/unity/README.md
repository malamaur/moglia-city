# Prova Unity WebGL (non eseguita)

Unity non è installato su questa macchina, quindi non ci sono misure. Questa è la procedura per rifare il confronto sullo stesso `moglia.glb`.

## Preparazione

1. Installa **Unity Hub** e **Unity 6 LTS** con il modulo **WebGL Build Support**.
2. Crea un progetto **3D (URP)**.
3. Apri **Window → Package Manager → + → Add package by name…** e aggiungi
   `com.unity.cloud.gltfast` (importatore glTF/GLB ufficiale).
4. Genera il modello dalla radice del repo:

   ```bash
   npm run glb
   ```

5. Copia `spike/moglia.glb` in `Assets/`. Unity lo importa come prefab.
6. Trascina il prefab nella scena, aggiungi una `Camera` in (1900, 1500, 2200) rivolta all'origine e una `Directional Light`.
7. Aggiungi `LoadTimer.cs` (sotto) a un GameObject vuoto.
8. **File → Build Settings → WebGL**; crea la build.

## Misura

`LoadTimer` stampa in console il tempo di avvio della scena e conta i triangoli.
Per il caricamento del GLB, metti il prefab in scena e leggi `scene_start_ms`: include il caricamento della scena.
Per isolarlo, carica il prefab da `Resources` con `Resources.Load<GameObject>()` e misura intorno alla chiamata.

Per l'hosting: Unity WebGL richiede un server HTTP; se usi i thread servono gli header `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp` (GitHub Pages non li imposta).

## Valutazione attesa

Unity WebGL aggiunge il runtime più pesante dei tre (build tipiche da decine di MB), ma non l'ho misurato: senza numeri non va messo nella tabella dei tempi.
