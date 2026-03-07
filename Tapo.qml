Item {
	anchors.fill: parent

	Column {
		width: 450
		height: parent.height
		spacing: 8

		// ── tapo-rest connection config ───────────────────────────────────
		Item {
			width: 450
			height: 158

			Rectangle {
				width: parent.width
				height: parent.height - 10
				radius: 5
				gradient: Gradient {
					orientation: Gradient.Horizontal
					GradientStop { position: 0.000; color: "#00b4d8" }
					GradientStop { position: 0.009; color: "#00b4d8" }
					GradientStop { position: 0.010; color: "#1e1e1e" }
					GradientStop { position: 1.000; color: "#1e1e1e" }
				}

				Column {
					x: 20
					y: 12
					width: parent.width - 34
					spacing: 8

					Row {
						spacing: 6
						Text { text: "⚡"; font.pixelSize: 13; color: "#00b4d8" }
						Text {
							text: "tapo-rest Connection"
							color: theme.primarytextcolor
							font.family: "Poppins"; font.bold: true; font.pixelSize: 13
						}
					}

					Row {
						spacing: 8
						Text {
							text: "HOST"; color: "#666"; font.family: "Poppins"
							font.pixelSize: 10; font.letterSpacing: 1; width: 70; height: 28
							verticalAlignment: Text.AlignVCenter
						}
						Rectangle {
							width: 220; height: 28; radius: 4; color: "#252525"
							border.color: hostField.activeFocus ? "#00b4d8" : "#383838"; border.width: 1
							TextField {
								id: hostField
								anchors.fill: parent; leftPadding: 10
								text: discovery.host || "127.0.0.1"
								color: theme.primarytextcolor
								font.family: "Poppins"; font.pixelSize: 12; background: Item {}
							}
						}
					}

					Row {
						spacing: 8
						Text {
							text: "PORT"; color: "#666"; font.family: "Poppins"
							font.pixelSize: 10; font.letterSpacing: 1; width: 70; height: 28
							verticalAlignment: Text.AlignVCenter
						}
						Rectangle {
							width: 90; height: 28; radius: 4; color: "#252525"
							border.color: portField.activeFocus ? "#00b4d8" : "#383838"; border.width: 1
							TextField {
								id: portField
								anchors.fill: parent; leftPadding: 10
								text: String(discovery.port || 8000)
								color: theme.primarytextcolor
								font.family: "Poppins"; font.pixelSize: 12; background: Item {}
								validator: IntValidator { bottom: 1; top: 65535 }
							}
						}
					}

					Row {
						spacing: 8
						Text {
							text: "PASSWORD"; color: "#666"; font.family: "Poppins"
							font.pixelSize: 10; font.letterSpacing: 1; width: 70; height: 28
							verticalAlignment: Text.AlignVCenter
						}
						Rectangle {
							width: 180; height: 28; radius: 4; color: "#252525"
							border.color: passwordField.activeFocus ? "#00b4d8" : "#383838"; border.width: 1
							TextField {
								id: passwordField
								anchors.fill: parent; leftPadding: 10
								text: discovery.password || ""
								echoMode: TextInput.Password
								color: theme.primarytextcolor
								font.family: "Poppins"; font.pixelSize: 12; background: Item {}
							}
						}
						Rectangle {
							width: 66; height: 28; radius: 4
							color: connMouse.containsMouse ? "#1a9abf" : "#0d7a9e"
							Text {
								anchors.centerIn: parent; text: "Apply"
								color: "white"; font.family: "Poppins"; font.bold: true; font.pixelSize: 11
							}
							MouseArea {
								id: connMouse; anchors.fill: parent
								hoverEnabled: true; cursorShape: Qt.PointingHandCursor
								onClicked: discovery.setServerConfig(hostField.text, portField.text, passwordField.text)
							}
						}
					}
				}
			}
		}

		// ── Render tuning ─────────────────────────────────────────────────
		Item {
			width: 450
			height: 118

			Rectangle {
				width: parent.width
				height: parent.height - 10
				radius: 5
				gradient: Gradient {
					orientation: Gradient.Horizontal
					GradientStop { position: 0.000; color: "#7b5ea7" }
					GradientStop { position: 0.009; color: "#7b5ea7" }
					GradientStop { position: 0.010; color: "#1e1e1e" }
					GradientStop { position: 1.000; color: "#1e1e1e" }
				}

				Column {
					x: 20
					y: 12
					width: parent.width - 34
					spacing: 8

					Row {
						spacing: 6
						Text { text: "🎞"; font.pixelSize: 13; color: "#7b5ea7" }
						Text {
							text: "Rendering"
							color: theme.primarytextcolor
							font.family: "Poppins"; font.bold: true; font.pixelSize: 13
						}
					}

					Row {
						spacing: 8
						Text {
							text: "FRAME SKIP"; color: "#666"; font.family: "Poppins"
							font.pixelSize: 10; font.letterSpacing: 1; width: 82; height: 28
							verticalAlignment: Text.AlignVCenter
						}
						Rectangle {
							width: 56; height: 28; radius: 4; color: "#252525"
							border.color: frameSkipField.activeFocus ? "#7b5ea7" : "#383838"; border.width: 1
							TextField {
								id: frameSkipField
								anchors.fill: parent; leftPadding: 10
								text: String(discovery.frameSkip || 6)
								color: theme.primarytextcolor
								font.family: "Poppins"; font.pixelSize: 12; background: Item {}
								validator: IntValidator { bottom: 1; top: 30 }
							}
						}
						Text {
							text: "~" + Math.round(30 / Math.max(1, parseInt(frameSkipField.text || "6"))) + " fps"
							color: "#7b5ea7"; font.family: "Poppins"; font.pixelSize: 11
							height: 28; verticalAlignment: Text.AlignVCenter
						}
					}

					Row {
						spacing: 8
						Text {
							text: "MIN DELTA"; color: "#666"; font.family: "Poppins"
							font.pixelSize: 10; font.letterSpacing: 1; width: 82; height: 28
							verticalAlignment: Text.AlignVCenter
						}
						Rectangle {
							width: 56; height: 28; radius: 4; color: "#252525"
							border.color: minDeltaField.activeFocus ? "#7b5ea7" : "#383838"; border.width: 1
							TextField {
								id: minDeltaField
								anchors.fill: parent; leftPadding: 10
								text: String(discovery.minDelta !== undefined ? discovery.minDelta : 3)
								color: theme.primarytextcolor
								font.family: "Poppins"; font.pixelSize: 12; background: Item {}
								validator: IntValidator { bottom: 0; top: 100 }
							}
						}
						Text {
							text: "HSV threshold (0 = always send)"
							color: "#555"; font.family: "Poppins"; font.pixelSize: 11
							height: 28; verticalAlignment: Text.AlignVCenter
						}
						Item { width: 1; height: 1 } // spacer
					}
				}

				// Apply button pinned to bottom-right of the card
				Rectangle {
					width: 66; height: 28; radius: 4
					anchors.right: parent.right; anchors.bottom: parent.bottom
					anchors.margins: 12
					color: renderMouse.containsMouse ? "#9370c4" : "#6a4f91"
					Text {
						anchors.centerIn: parent; text: "Apply"
						color: "white"; font.family: "Poppins"; font.bold: true; font.pixelSize: 11
					}
					MouseArea {
						id: renderMouse; anchors.fill: parent
						hoverEnabled: true; cursorShape: Qt.PointingHandCursor
						onClicked: discovery.setRenderConfig(frameSkipField.text, minDeltaField.text)
					}
				}
			}
		}

		// ── Section header ────────────────────────────────────────────────
		Item {
			width: 450
			height: 30

			Text {
				id: sectionLabel
				text: "DISCOVERED DEVICES"
				color: "#555"; font.family: "Poppins"; font.pixelSize: 10; font.letterSpacing: 1.5
				anchors.verticalCenter: parent.verticalCenter; x: 2
			}
			Rectangle {
				height: 1; color: "#333"
				anchors.left: sectionLabel.right; anchors.leftMargin: 10
				anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
			}
		}

		// ── Discovered devices ────────────────────────────────────────────
		ListView {
			id: controllerList
			model: service.controllers
			width: 450
			height: parent.height - 158 - 118 - 30 - 24 // cards + header + spacing
			clip: true

			ScrollBar.vertical: ScrollBar {
				anchors.right: parent.right; width: 10
				visible: parent.height < parent.contentHeight
				policy: ScrollBar.AlwaysOn
				contentItem: Rectangle { radius: parent.width / 2; color: theme.scrollBar }
			}

			delegate: Item {
				width: 450
				height: 90
				property var dev: model.modelData.obj

				Rectangle {
					width: parent.width
					height: parent.height - 10
					radius: 5
					gradient: Gradient {
						orientation: Gradient.Horizontal
						GradientStop { position: 0.000; color: "#29b6a8" }
						GradientStop { position: 0.009; color: "#29b6a8" }
						GradientStop { position: 0.010; color: "#1e1e1e" }
						GradientStop { position: 1.000; color: "#1e1e1e" }
					}

					Row {
						x: 20; y: 14; spacing: 8
						Text {
							text: dev.name
							color: theme.primarytextcolor
							font.family: "Poppins"; font.bold: true; font.pixelSize: 15
						}
						Rectangle {
							radius: 3; color: "#1a3a40"
							width: typeLabel.width + 12; height: 18
							anchors.verticalCenter: parent.verticalCenter
							Text {
								id: typeLabel
								text: dev.deviceType.toUpperCase()
								color: "#29b6a8"; font.family: "Poppins"; font.bold: true
								font.pixelSize: 10; font.letterSpacing: 0.5; anchors.centerIn: parent
							}
						}
					}

					Column {
						x: 20; y: 44; spacing: 2
						Text { text: dev.ip + ":" + dev.port; color: "#888"; font.family: "Poppins"; font.pixelSize: 11 }
						Text { text: "device: " + dev.deviceName; color: "#666"; font.family: "Poppins"; font.pixelSize: 11 }
					}

					Rectangle {
						width: 6; height: 6; radius: 3; color: "#29b6a8"; opacity: 0.6
						anchors.right: parent.right; anchors.top: parent.top; anchors.margins: 14
					}
				}
			}
		}
	}
}
