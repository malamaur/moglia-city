extends Node3D

# Spike di caricamento + camera libera per esplorare il GLB di Moglia.
# WASD vola, Q/E scende/sale, Shift accelera, mouse guarda (clicca per catturarlo), Esc esce.

var yaw := 0.0
var pitch := -0.48
var fly_speed := 120.0
var camera: Camera3D

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

	camera = $Camera3D
	var from := Vector3(1900, 1500, 2200)
	var d := (Vector3.ZERO - from).normalized()
	pitch = asin(d.y)
	yaw = atan2(-d.x, -d.z)
	camera.position = from
	camera.rotation = Vector3(pitch, yaw, 0)
	camera.far = 20000

	# stessa direzione del sole del gioco Three.js: (-0.55, 0.75, 0.38)
	$Sun.look_at(Vector3(0.55, -0.75, -0.38).normalized())
	$Sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	$Sun.directional_shadow_max_distance = 5000.0

	print("MOGLIA load_ms=%.1f instantiate_ms=%.1f triangles=%d meshes=%d" % [(t1 - t0) / 1000.0, (t2 - t1) / 1000.0, tris, mesh_count])

	if DisplayServer.get_name() == "headless":
		for i in range(3):
			await get_tree().process_frame
		print("MOGLIA frame_ms=%.2f" % (1000.0 / maxf(Engine.get_frames_per_second(), 1.0)))
		await get_tree().create_timer(0.2).timeout
		get_tree().quit()
	elif "--shot" in OS.get_cmdline_user_args():
		for i in range(10):
			await get_tree().process_frame
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		img.save_png("/tmp/moglia-godot.png")
		print("MOGLIA shot=/tmp/moglia-godot.png")
		get_tree().quit()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * 0.0035
		pitch = clampf(pitch - event.relative.y * 0.0035, -1.5, 1.5)
		camera.rotation = Vector3(pitch, yaw, 0)
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		get_tree().quit()

func _process(delta: float) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var dir := Vector3.ZERO
	if Input.is_key_pressed(KEY_W): dir.z -= 1.0
	if Input.is_key_pressed(KEY_S): dir.z += 1.0
	if Input.is_key_pressed(KEY_A): dir.x -= 1.0
	if Input.is_key_pressed(KEY_D): dir.x += 1.0
	if Input.is_key_pressed(KEY_Q): dir.y -= 1.0
	if Input.is_key_pressed(KEY_E): dir.y += 1.0
	if dir != Vector3.ZERO:
		var speed := fly_speed * (4.0 if Input.is_key_pressed(KEY_SHIFT) else 1.0)
		camera.position += camera.basis * dir.normalized() * speed * delta
