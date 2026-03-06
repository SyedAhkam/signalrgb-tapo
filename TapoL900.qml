Item {
	anchors.fill: parent

	ListView {
		id: controllerList
		model: service.controllers
		width: 450
		height: parent.height
		clip: true

		ScrollBar.vertical: ScrollBar {
			anchors.right: parent.right
			width: 10
			visible: parent.height < parent.contentHeight
			policy: ScrollBar.AlwaysOn
			contentItem: Rectangle {
				radius: parent.width / 2
				color: theme.scrollBar
			}
		}

		delegate: Item {
			width: 450
			height: 90
			property var dev: model.modelData.obj

			Rectangle {
				width: parent.width
				height: parent.height - 10
				radius: 5
				color: "#1e1e1e"

				Column {
					x: 14
					y: 12
					spacing: 6

					Text {
						text: dev.name
						color: theme.primarytextcolor
						font.family: "Poppins"
						font.bold: true
						font.pixelSize: 15
					}

					Text {
						text: dev.ip + ":" + dev.port + "  |  device: " + dev.deviceName + "  |  type: " + dev.deviceType
						color: "#aaaaaa"
						font.family: "Poppins"
						font.pixelSize: 12
					}
				}
			}
		}
	}
}
