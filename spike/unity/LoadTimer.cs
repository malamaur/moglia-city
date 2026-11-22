using UnityEngine;

// Misura avvio scena e triangoli. Da mettere su un GameObject vuoto nella scena con moglia.glb.
public class LoadTimer : MonoBehaviour
{
    void Start()
    {
        int triangles = 0;
        int meshes = 0;
        foreach (var mf in FindObjectsByType<MeshFilter>(FindObjectsSortMode.None))
        {
            if (mf.sharedMesh == null) continue;
            meshes++;
            triangles += mf.sharedMesh.triangles.Length / 3;
        }
        Debug.Log($"MOGLIA scene_start_ms={Time.realtimeSinceStartup * 1000f:F1} triangles={triangles} meshes={meshes}");
    }
}
