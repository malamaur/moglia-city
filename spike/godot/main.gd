extends Node3D

# Misura caricamento e istanziazione di moglia.glb, poi esce in modalità headless.
func _ready() -> void:
	var t0 := Time.get_ticks_usec()
	var packed: PackedScene = load("res://moglia.glb")
	var t1 := Time.get_ticks_usec()
	var city := packed.instantiate()
	add_child(city)
	var t2 := Time.get_ticks_usec()

	var tris := 0
	var mesh_count := 0
	for mi in city.find_children("*", "MeshInstance3D", true, false):
		mesh_count += 1
		var m: Mesh = mi.mesh
		if m == null:
			continue
		for s in range(m.get_surface_count()):
			var arrays := m.surface_get_arrays(s)
			var idx = arrays[Mesh.ARRAY_INDEX]
			if idx != null:
				tris += idx.size() / 3
			else:
				tris += arrays[Mesh.ARRAY_VERTEX].size() / 3

	$Camera3D.look_at_from_position(Vector3(1900, 1500, 2200), Vector3.ZERO, Vector3.UP)
	print("MOGLIA load_ms=%.1f instantiate_ms=%.1f triangles=%d meshes=%d" % [(t1 - t0) / 1000.0, (t2 - t1) / 1000.0, tris, mesh_count])

	for i in range(3):
		await get_tree().process_frame
	print("MOGLIA frame_ms=%.2f" % (1000.0 / maxf(Engine.get_frames_per_second(), 1.0)))
	await get_tree().create_timer(0.2).timeout
	if DisplayServer.get_name() == "headless":
		get_tree().quit()
