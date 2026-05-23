import torch
import argparse
import os
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# --- 1. PYTORCH 2.6+ FIX ---
# This forces weights_only=False unless specified otherwise to handle local training files
_original_load = torch.load

def _safe_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)

torch.load = _safe_load

# Now we can import YOLO safely
from ultralytics import YOLO

def generate_performance_chart(class_names, ap50_values, overall_metrics, save_path="model_performance_summary.png"):
    """
    Generates and saves a professional bar chart based on dynamic model results.
    """
    # Create DataFrame from dynamic data
    df = pd.DataFrame({
        'Class': class_names,
        'mAP50': ap50_values
    })
    
    # Sort by mAP50 for better visualization
    df = df.sort_values('mAP50', ascending=True)

    # Setup Plot
    plt.figure(figsize=(12, 6))
    sns.set_style("whitegrid")
    
    # 1. Create the Horizontal Bar Chart
    # Use a color palette that scales with performance (optional) or static
    colors = sns.color_palette("viridis", len(df))
    bars = plt.barh(df['Class'], df['mAP50'], color=colors, alpha=0.8, height=0.6)

    # 2. Add Data Labels inside/next to bars
    for bar in bars:
        width = bar.get_width()
        # Place text slightly to the right of the bar
        plt.text(width + 0.01, 
                 bar.get_y() + bar.get_height()/2, 
                 f'{width:.1%}', 
                 va='center', fontweight='bold', fontsize=10)

    # 3. Add a vertical line for the Average mAP
    plt.axvline(overall_metrics['map50'], color='red', linestyle='--', alpha=0.7)
    plt.text(overall_metrics['map50'] + 0.01, 
             len(df) - 0.5, 
             f"Mean mAP: {overall_metrics['map50']:.1%}", 
             color='red', fontweight='bold')

    # 4. Add a text box for Global Context (Precision/Recall)
    textstr = '\n'.join((
        r'$\bf{Global\ Metrics}$',
        f'Precision: {overall_metrics["precision"]:.1%}',
        f'Recall:    {overall_metrics["recall"]:.1%}',
        f'mAP 50-95: {overall_metrics["map"]:.3f}'
    ))
    props = dict(boxstyle='round', facecolor='whitesmoke', alpha=0.5)
    plt.gca().text(0.1, 0.95, textstr, transform=plt.gca().transAxes, fontsize=12,
            verticalalignment='top', bbox=props)

    # 5. Styling
    plt.title('Model Performance by Class (YOLOv8)', fontsize=16, fontweight='bold', pad=20)
    plt.xlabel('Accuracy (mAP @ 50% IoU)', fontsize=12)
    plt.xlim(0, 1.15)  # Set limit slightly above 1 to fit labels
    plt.grid(axis='y') # Remove horizontal grid lines
    plt.tight_layout()
    
    # Save
    plt.savefig(save_path, dpi=300)
    print(f"✅ Chart saved successfully to: {save_path}")

def main():
    # --- 2. ARGUMENT PARSING ---
    parser = argparse.ArgumentParser(description="Evaluate YOLOv8 Model and Generate Report")
    parser.add_argument("--model", type=str, required=True, help="Path to best.pt file")
    parser.add_argument("--data", type=str, required=True, help="Path to data.yaml file")
    parser.add_argument("--split", type=str, default="val", help="Split to evaluate (val or test)")
    args = parser.parse_args()

    print(f"🚀 Loading model from: {args.model}")
    model = YOLO(args.model)

    # --- 3. RUN EVALUATION ---
    print(f"📊 Running evaluation on '{args.split}' set...")
    metrics = model.val(data=args.data, split=args.split)

    # --- 4. EXTRACT METRICS DYNAMICALLY ---
    # Global metrics
    overall_stats = {
        'map': metrics.box.map,       # mAP50-95
        'map50': metrics.box.map50,   # mAP50
        'precision': metrics.box.mp,  # Mean Precision
        'recall': metrics.box.mr      # Mean Recall
    }

    # Per-class metrics
    # metrics.names is a dict {0: 'classA', 1: 'classB'}
    # metrics.box.ap50 is an array of mAP50 scores per class
    class_ids = sorted(metrics.names.keys())
    class_names = [metrics.names[i] for i in class_ids]
    ap50_values = metrics.box.ap50 

    # Print to console for verification
    print("\n" + "="*30)
    print("RESULTS SUMMARY")
    print("="*30)
    print(f"Global mAP50:    {overall_stats['map50']:.3f}")
    print(f"Global mAP50-95: {overall_stats['map']:.3f}")
    print(f"Global Precision: {overall_stats['precision']:.3f}")
    print(f"Global Recall:    {overall_stats['recall']:.3f}")
    print("-" * 30)
    print("Per Class mAP50:")
    for name, val in zip(class_names, ap50_values):
        print(f"  {name:<15} {val:.3f}")
    print("="*30 + "\n")

    # --- 5. GENERATE CHART ---
    print("🎨 Generating visualization...")
    generate_performance_chart(class_names, ap50_values, overall_stats)

if __name__ == "__main__":
    main()