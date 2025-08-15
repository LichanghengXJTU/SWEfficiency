import timeit
import statistics

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Polygon
import tempfile
import os

tempfile_path = tempfile.NamedTemporaryFile(delete=False).name

def tstack(a):
    return np.concatenate([x[..., np.newaxis] for x in a], axis=-1)

x_min, x_max = 360, 780
wl = np.arange(x_min, x_max, 1)
wl_len = len(wl)
colours = np.random.random([wl_len, 3])  # random colours held constant per run
padding = 0.1


def workload():
    """
    The code whose performance we want to measure.
    Re-creates the figure each iteration so the measurement includes
    everything from plotting through layout to file I/O.
    """
    values = np.sin(wl / 50) * 125 + 125

    fig = plt.figure(figsize=(10.24, 7.68))
    ax = fig.gca()

    # Construct clipping polygon
    polygon = Polygon(
        np.vstack([
            (x_min, 0),
            tstack([wl, values]),
            (x_max, 0),
        ]),
        facecolor='none',
        edgecolor='none'
    )
    ax.add_patch(polygon)

    # Draw bars clipped by the polygon
    ax.bar(
        x=wl - padding,
        height=max(values),
        width=1 + padding,
        color=colours,
        align='edge',
        clip_path=polygon
    )

    # Overlay line plot and axis limits
    ax.plot(wl, values)
    ax.set_xlim(x_min, x_max)
    ax.set_ylim(0, 250)

    fig.tight_layout()
    fig.savefig(tempfile_path)
    plt.close(fig)
    
os.remove(tempfile_path)  # Clean up the temporary file after saving

runtimes = timeit.repeat(workload, number=1, repeat=3)

print("Mean:", statistics.mean(runtimes))
print("Std Dev:", statistics.stdev(runtimes))
