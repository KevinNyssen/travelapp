from django.db import models


class Place(models.Model):
    PURPOSE_CHOICES = [
        ('medical', 'Medical'),
        ('recreation', 'Recreation'),
        ('work', 'Work'),
        ('visit', 'Visit'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    cost_level = models.IntegerField(default=1)  # 1 cheap – 5 expensive
    visit_time = models.IntegerField(default=60)  # minutes spent there

    def __str__(self):
        return self.name
