import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gdk from "gi://Gdk";
import Graphene from "gi://Graphene";
import Gtk from "gi://Gtk";
import { PanelElements } from "../../types/enums/common.js";

interface PanelElementRow extends Adw.ActionRow {
    elementKey: string;
}

class ElementList extends Adw.PreferencesGroup {
    public elements: string[];

    private listBox: Gtk.ListBox;
    private iconRow: PanelElementRow;
    private labelRow: PanelElementRow;
    private controlsRow: PanelElementRow;

    constructor(params = {}) {
        super(params);

        // @ts-expect-error Typescript doesn't know about the internal children
        this.listBox = this._list_box;
        // @ts-expect-error Typescript doesn't know about the internal children
        this.iconRow = this._icon_row;
        this.iconRow.elementKey = "ICON";
        // @ts-expect-error Typescript doesn't know about the internal children
        this.labelRow = this._label_row;
        this.labelRow.elementKey = "LABEL";
        // @ts-expect-error Typescript doesn't know about the internal children
        this.controlsRow = this._controls_row;
        this.controlsRow.elementKey = "CONTROLS";

        this.elements = [];

        const dropTarget = Gtk.DropTarget.new(GObject.TYPE_UINT, Gdk.DragAction.MOVE);
        dropTarget.connect("drop", (_, sourceIndex, x, y) => {
            const targetRow = this.listBox.get_row_at_y(y);
            if (targetRow == null || sourceIndex == null) return;

            const sourceValue = this.elements[sourceIndex];
            const targetIndex = targetRow.get_index();

            this.elements.splice(targetIndex > sourceIndex ? targetIndex + 1 : targetIndex, 0, sourceValue);
            this.elements.splice(sourceIndex > targetIndex ? sourceIndex + 1 : sourceIndex, 1);

            this.notify("elements");
            this.listBox.drag_unhighlight_row();
            this.listBox.invalidate_sort();
        });

        this.listBox.add_controller(dropTarget);
        this.listBox.set_sort_func((firstRow: PanelElementRow, secondRow: PanelElementRow) => {
            const firstIndex = this.elements.indexOf(firstRow.elementKey);
            const secondIndex = this.elements.indexOf(secondRow.elementKey);

            return firstIndex - secondIndex;
        });
    }

    public initElements(elements: string[]) {
        for (let i = 0; i < elements.length; i++) {
            let dragX = 0;
            let dragY = 0;

            const dragSource = new Gtk.DragSource({ actions: Gdk.DragAction.MOVE });
            const dropController = new Gtk.DropControllerMotion();

            dragSource.connect("prepare", (dragSource, x, y) => {
                dragX = x;
                dragY = y;

                const row = dragSource.widget as Adw.ActionRow;
                const index = row.get_index();

                const value = new GObject.Value();
                value.init(GObject.TYPE_UINT);
                value.set_uint(index);

                const content = Gdk.ContentProvider.new_for_value(value);
                return content;
            });

            dragSource.connect("drag-begin", (dragSource) => {
                const row = dragSource.widget as Adw.ActionRow;
                const icon = this.snapshotRow(row);
                dragSource.set_icon(icon, dragX, dragY);
            });

            dropController.connect("enter", (dropController) => {
                const row = dropController.widget as Adw.ActionRow;
                this.listBox.drag_highlight_row(row);
            });

            dropController.connect("leave", () => {
                this.listBox.drag_unhighlight_row();
            });

            const element = PanelElements[elements[i]];

            if (element === PanelElements.ICON) {
                this.iconRow.add_controller(dragSource);
                this.iconRow.add_controller(dropController);
            } else if (element === PanelElements.LABEL) {
                this.labelRow.add_controller(dragSource);
                this.labelRow.add_controller(dropController);
            } else if (element === PanelElements.CONTROLS) {
                this.controlsRow.add_controller(dragSource);
                this.controlsRow.add_controller(dropController);
            }
        }

        this.elements = elements;
        this.listBox.invalidate_sort();
    }

    private snapshotRow(row: Adw.PreferencesRow) {
        const paintable = new Gtk.WidgetPaintable({ widget: row });
        const width = row.get_allocated_width();
        const height = row.get_allocated_height();

        const snapshot = new Gtk.Snapshot();
        paintable.snapshot(snapshot, width, height);

        const node = snapshot.to_node();
        const renderer = row.get_native().get_renderer();

        const rect = new Graphene.Rect();
        rect.init(0, 0, width, height);

        const texture = renderer.render_texture(node, rect);
        return texture;
    }
}

export default ElementList;
